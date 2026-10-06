import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const auto = readFileSync(new URL("../notifications-auto.ts", import.meta.url), "utf8");
const welcome = auto.slice(
  auto.indexOf("export async function dispatchWelcomeNotification"),
  auto.indexOf("async function sendWelcomeEmail"),
);
const migration = readFileSync(new URL("../../../supabase/migrations/078_profile_welcomed_at.sql", import.meta.url), "utf8");

test("the welcome is claimed on the account, before anything is sent", () => {
  const claim = welcome.indexOf(".set({ welcomedAt: new Date() })");
  const insert = welcome.indexOf("db.insert(schema.notifications)");
  const email = welcome.indexOf("sendWelcomeEmail(userId)");
  assert.ok(claim > -1, "profiles.welcomed_at is set");
  assert.match(welcome, /isNull\(schema\.profiles\.welcomedAt\)/, "only while it is still unset, so one sign-in wins");
  assert.match(welcome, /if \(claimed\.length === 0\) return;/);
  assert.ok(claim < insert && insert < email, "claim, then notification, then email");
});

test("a deleted or reaped welcome notification does not bring the welcome back", () => {
  // The reaper deletes read notifications after 30 days and members can delete
  // their own; the old guard looked for the notification, so both re-welcomed.
  assert.doesNotMatch(welcome, /eq\(schema\.notifications\.category, "welcome"\)/);
});

test("accounts already welcomed, or that have signed in, are backfilled", () => {
  assert.match(migration, /add column if not exists welcomed_at timestamptz/);
  assert.match(migration, /n\.category = 'welcome'/, "already welcomed");
  assert.match(migration, /u\.last_sign_in_at is not null/, "signed in before, so already welcomed on sign-in");
  assert.match(migration, /where p\.welcomed_at is null/, "re-runnable");
});
