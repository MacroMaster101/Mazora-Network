import assert from "node:assert/strict";
import test from "node:test";
import {
  assessBackup,
  BACKUP_STALE_AFTER_MS,
  normalizeRepo,
  type BackupRun,
} from "@/lib/backup-status";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

const run = (overrides: Partial<BackupRun> = {}): BackupRun => ({
  conclusion: "success",
  finishedAt: new Date(NOW - 2 * DAY).toISOString(),
  rows: 576,
  tables: 29,
  url: "https://github.com/x/y/actions/runs/1",
  ...overrides,
});

test("a recent successful run is healthy", () => {
  const result = assessBackup(run(), NOW, true);
  assert.equal(result.health, "healthy");
  assert.equal(result.ageMs, 2 * DAY);
});

test("a successful run older than the stale window is late", () => {
  const old = run({ finishedAt: new Date(NOW - 11 * DAY).toISOString() });
  assert.equal(assessBackup(old, NOW, true).health, "late");
});

test("the stale boundary is inclusive — exactly at the limit is still healthy", () => {
  // Off-by-one here makes the card cry wolf every single week at the same hour.
  const edge = run({ finishedAt: new Date(NOW - BACKUP_STALE_AFTER_MS).toISOString() });
  assert.equal(assessBackup(edge, NOW, true).health, "healthy");
});

test("a failed run is reported as failed, however recent", () => {
  assert.equal(assessBackup(run({ conclusion: "failure" }), NOW, true).health, "failed");
  assert.equal(assessBackup(run({ conclusion: "cancelled" }), NOW, true).health, "failed");
  assert.equal(assessBackup(run({ conclusion: "timed_out" }), NOW, true).health, "failed");
});

test("a run still in progress is not mistaken for a failure", () => {
  // GitHub reports conclusion=null while a run is executing. Calling that
  // "failed" would show a red card every Sunday morning mid-run.
  assert.equal(assessBackup(run({ conclusion: null }), NOW, true).health, "running");
});

test("no runs at all is distinct from a failure", () => {
  const result = assessBackup(null, NOW, true);
  assert.equal(result.health, "never");
  assert.equal(result.ageMs, null);
});

test("missing configuration is reported as such, not as a broken backup", () => {
  // A card that says "FAILED" because an env var is unset sends someone
  // debugging the backup instead of setting the variable.
  assert.equal(assessBackup(run(), NOW, false).health, "unconfigured");
  assert.equal(assessBackup(null, NOW, false).health, "unconfigured");
});

test("an unreadable timestamp never counts as healthy", () => {
  // We cannot prove freshness, so we must not claim it. Reported late with an
  // unknown age, which prompts a look rather than quiet false comfort.
  for (const finishedAt of [null, "", "not-a-date"]) {
    const result = assessBackup(run({ finishedAt }), NOW, true);
    assert.equal(result.health, "late", `for ${JSON.stringify(finishedAt)}`);
    assert.equal(result.ageMs, null);
  }
});

test("a future timestamp is clamped rather than reported as negative age", () => {
  // Clock skew between GitHub and us should not render "-3 hours ago".
  const result = assessBackup(run({ finishedAt: new Date(NOW + 3 * 60 * 60 * 1000).toISOString() }), NOW, true);
  assert.equal(result.health, "healthy");
  assert.equal(result.ageMs, 0);
});

test("the stale window allows one missed weekly run before complaining", () => {
  // Weekly schedule plus slack: a single delayed run is not an incident.
  assert.ok(BACKUP_STALE_AFTER_MS > 7 * DAY, "must tolerate the normal weekly gap");
  assert.ok(BACKUP_STALE_AFTER_MS < 14 * DAY, "must notice two consecutive misses");
});

test("the repository setting accepts what a person is likely to paste", () => {
  // owner/repo is the documented form, but a full URL copied from the address
  // bar is the obvious mistake, and it would otherwise fail as a bare 404 with
  // nothing pointing at the cause.
  for (const input of [
    "MacroMaster101/mazora-backups",
    "https://github.com/MacroMaster101/mazora-backups",
    "http://github.com/MacroMaster101/mazora-backups",
    "github.com/MacroMaster101/mazora-backups",
    "https://github.com/MacroMaster101/mazora-backups.git",
    "  MacroMaster101/mazora-backups/  ",
  ]) {
    assert.equal(normalizeRepo(input), "MacroMaster101/mazora-backups", `for ${JSON.stringify(input)}`);
  }
});

test("anything that is not an owner/repo pair is rejected, not guessed at", () => {
  for (const input of ["", "   ", "mazora-backups", "a/b/c/d", "https://example.com/x/y"]) {
    assert.equal(normalizeRepo(input), null, `for ${JSON.stringify(input)}`);
  }
});
