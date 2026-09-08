import assert from "node:assert/strict";
import test from "node:test";
import {
  assessBackup,
  BACKUP_STALE_AFTER_MS,
  formatBackupSize,
  normalizeRepo,
  parseRunLog,
  type BackupRun,
} from "@/lib/backup-status";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

const run = (overrides: Partial<BackupRun> = {}): BackupRun => ({
  conclusion: "success",
  finishedAt: new Date(NOW - 2 * DAY).toISOString(),
  rows: 576,
  tables: 29,
  storedMb: 84,
  storageObjects: 54,
  storedInR2: true,
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

/*
  A real excerpt from a job log, timestamp prefixes and all.

  The log is the only place these numbers are reachable: GitHub's REST API
  exposes a run's conclusion and its jobs, but never the step summary a workflow
  writes to $GITHUB_STEP_SUMMARY. Parsing the log is not a shortcut, it is the
  only route.
*/
const LOG = [
  "2026-09-08T10:15:35.1892085Z Dumping 27 public tables...",
  "2026-09-08T10:15:36.0454530Z   public.audit_logs                           310 rows",
  "2026-09-08T10:15:42.2292686Z   public.rule_categories                       10 rows",
  "2026-09-08T10:15:44.0000000Z ✓ 576 rows from 29 tables",
  "2026-09-08T10:16:01.0000000Z ✓ 54 downloaded (83.8 MB), 0 already present, 0 failed",
  "2026-09-08T10:16:20.0000000Z in R2: 30 db objects, 54 storage objects, 84 MB",
].join("\n");

test("the job log yields rows, tables and the size confirmed in R2", () => {
  const parsed = parseRunLog(LOG);
  assert.equal(parsed.rows, 576);
  assert.equal(parsed.tables, 29);
  assert.equal(parsed.storedMb, 84);
  assert.equal(parsed.storageObjects, 54);
  assert.equal(parsed.storedInR2, true);
});

test("a per-table line is not mistaken for the total", () => {
  // Every table prints its own "310 rows". Matching the first one would report
  // the alphabetically-first table as the size of the whole backup.
  assert.equal(parseRunLog(LOG).rows, 576);
  const onlyTables = "  public.audit_logs   310 rows" + "\n" + "  public.orders   1 rows";
  assert.equal(parseRunLog(onlyTables).rows, null);
});

test("the size reported is the one confirmed in R2, not the local download", () => {
  // The downloaded figure only proves the pull from Supabase worked. If the two
  // ever disagree, the R2 one is the only one describing an actual backup.
  const mismatched = LOG.replace("(83.8 MB)", "(999 MB)");
  assert.equal(parseRunLog(mismatched).storedMb, 84);
});

test("a run from before the verify step still reports what the dump proved", () => {
  // The first run predates that step. Showing rows, tables and the downloaded
  // size beats showing nothing at all.
  const older = LOG.split("\n").filter((line) => !line.includes("in R2:")).join("\n");
  const parsed = parseRunLog(older);
  assert.equal(parsed.rows, 576);
  assert.equal(parsed.tables, 29);
  assert.equal(parsed.storedMb, 83.8);
  assert.equal(parsed.storageObjects, 54);
  // …but it must not be described as confirmed in R2, because it was not. That
  // number is what left Supabase, not what arrived in the bucket.
  assert.equal(parsed.storedInR2, false);
});

test("thousands separators in the row count are read correctly", () => {
  assert.equal(parseRunLog("✓ 1,234,567 rows from 31 tables").rows, 1234567);
});

test("an unparseable or empty log yields nulls, never zeroes", () => {
  // Zero rows and "we could not tell" are different facts. Showing "0 rows"
  // for an unreadable log would report a catastrophe that did not happen.
  for (const text of ["", "no numbers here", "##[group]Run set -euo pipefail"]) {
    const parsed = parseRunLog(text);
    assert.equal(parsed.rows, null, `for ${JSON.stringify(text)}`);
    assert.equal(parsed.tables, null);
    assert.equal(parsed.storedMb, null);
    assert.equal(parsed.storageObjects, null);
  }
});

test("the backup size reads as a size, not as a raw megabyte count", () => {
  // The dump is 84 MB today and only grows. "12288 MB" is technically correct
  // and unreadable at a glance, which is the only thing this card is for.
  assert.equal(formatBackupSize(84), "84 MB");
  assert.equal(formatBackupSize(1024), "1 GB");
  assert.equal(formatBackupSize(12288), "12 GB");
  assert.equal(formatBackupSize(1536), "1.5 GB");
});

test("an unknown size is omitted rather than shown as zero", () => {
  assert.equal(formatBackupSize(null), null);
  assert.equal(formatBackupSize(0), null);
});
