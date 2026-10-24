import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as backupRules from "@/lib/backup-status";
import { summarise } from "@/lib/audit-subject";
import { loadServerModule } from "./helpers/server-module";
import type * as BackupData from "@/lib/data/backup-status";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const REPO = "Example-Org/example-backups";

type Call = { url: string; method: string; body: string | null };

/** The data module with GitHub replaced by `answer`, recording every request. */
function loadWith(answer: (call: Call) => Response, env: Record<string, string> = { GITHUB_BACKUP_TOKEN: "test-token", GITHUB_BACKUP_REPO: REPO }) {
  const calls: Call[] = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    const call = { url, method: init.method ?? "GET", body: typeof init.body === "string" ? init.body : null };
    calls.push(call);
    return answer(call);
  };
  const data = loadServerModule<typeof BackupData>(new URL("../data/backup-status.ts", import.meta.url), {
    env,
    mocks: { "@/lib/backup-status": backupRules },
    globals: { fetch },
  });
  return { data, calls };
}

const runs = (conclusion: string | null) =>
  Response.json({ workflow_runs: [{ conclusion, updated_at: "2026-10-01T00:00:00Z", html_url: "https://example.com/run", id: 1 }] });

describe("dispatchBackup", () => {
  test("starts the workflow on main when nothing is running", async () => {
    const { data, calls } = loadWith((call) => (call.method === "POST" ? new Response(null, { status: 204 }) : runs("failure")));
    assert.equal(await data.dispatchBackup(), "started");
    const post = calls.find((call) => call.method === "POST");
    assert.equal(post?.url, `https://api.github.com/repos/${REPO}/actions/workflows/backup.yml/dispatches`);
    assert.deepEqual(JSON.parse(post?.body ?? "{}"), { ref: "main" });
  });

  test("refuses while a run is queued or in progress, without starting another", async () => {
    const { data, calls } = loadWith(() => runs(null));
    assert.equal(await data.dispatchBackup(), "already-running");
    assert.equal(calls.filter((call) => call.method === "POST").length, 0);
  });

  test("a read-only token is reported as such", async () => {
    const { data } = loadWith((call) => (call.method === "POST" ? new Response(null, { status: 403 }) : runs("failure")));
    assert.equal(await data.dispatchBackup(), "no-write-access");
  });

  test("an unreachable GitHub is a failure, not a throw", async () => {
    const { data } = loadWith(() => {
      throw new Error("offline");
    });
    assert.equal(await data.dispatchBackup(), "failed");
  });

  test("without a token or repository nothing is called", async () => {
    const { data, calls } = loadWith(() => runs("success"), {});
    assert.equal(data.canDispatchBackup(), false);
    assert.equal(await data.dispatchBackup(), "unconfigured");
    assert.equal(calls.length, 0);
  });
});

describe("Run backup now", () => {
  const action = read("../actions/backup.ts");

  test("is owner and Web Dev only", () => {
    assert.match(action, /!hasAtLeast\(session\.role, "owner"\)/);
  });

  test("checks the half-hour limit first and counts it only once a run has started", () => {
    const peek = action.indexOf("await peekRateLimitShared(MANUAL_BACKUP_KEY");
    const dispatch = action.indexOf("await dispatchBackup()");
    const count = action.indexOf("await rateLimitShared(MANUAL_BACKUP_KEY");
    assert.ok(peek > 0 && peek < dispatch && dispatch < count, "peek, then dispatch, then count");
    assert.match(action, /failureMode: "closed"/);
    assert.match(action, /MANUAL_BACKUP_WINDOW_MS = 30 \* 60 \* 1000/);
  });

  test("is written to the audit log with a readable summary", () => {
    assert.match(action, /action: "backup\.run_now"/);
    assert.equal(summarise("backup.run_now", "backup", null, {}), "Manual backup started");
  });

  test("the card offers it only when backups are connected, and never offers a restore", () => {
    const card = read("../../components/admin/backup-status-card.tsx");
    assert.match(card, /\{canRunNow && <BackupRunButton disabled=\{spinning\} \/>\}/);
    assert.doesNotMatch(card, /runRestore|restoreBackup|<button[^>]*>\s*Restore/i);
    assert.match(read("../../app/admin/settings/page.tsx"), /canRunNow=\{canDispatchBackup\(\)\}/);
    const button = read("../../components/admin/backup-run-button.tsx");
    assert.match(button, /setConfirming\(true\)/, "asks before starting");
  });
});

describe("backup scripts live in the backups repository only", () => {
  test("no copy or npm alias here to drift from it", () => {
    assert.equal(existsSync(new URL("../../../scripts/backup.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../../../scripts/backup-storage.ts", import.meta.url)), false);
    const scripts = JSON.parse(read("../../../package.json")).scripts as Record<string, string>;
    assert.equal(Object.keys(scripts).some((name) => name.startsWith("backup")), false);
  });
});
