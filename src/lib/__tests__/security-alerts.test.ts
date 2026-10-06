import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { alertLabel, alertTime, buildSecurityAlertEmail } from "@/lib/email/security-alert-email";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/079_security_alerts.sql");
const delivery = read("../security-alerts.ts");

const at = new Date("2026-01-02T14:05:00Z");
const origin = "https://example.com/";

/* ------------------------------------------------------------------ email */

test("one added passkey reads as that passkey, with its name and time", () => {
  const email = buildSecurityAlertEmail({ name: "Steve_42", origin, items: [{ kind: "passkey", label: "Windows Hello", at }] });
  assert.equal(email.subject, "A passkey was added to your Mazora account");
  assert.match(email.text, /^Hi Steve_42,/);
  assert.match(email.text, /A passkey \("Windows Hello"\), Jan 2, 2026, 2:05 PM UTC/);
  assert.match(email.text, /Security settings: https:\/\/example\.com\/dashboard\/settings/);
  assert.match(email.html, /href="https:\/\/example\.com\/dashboard\/settings"/);
  assert.match(email.text, /If it wasn't you/);
});

test("several at once are listed together under one subject", () => {
  const email = buildSecurityAlertEmail({
    name: null,
    origin,
    items: [
      { kind: "totp", label: null, at },
      { kind: "passkey", label: "YubiKey", at },
    ],
  });
  assert.equal(email.subject, "New sign-in methods were added to your Mazora account");
  assert.match(email.text, /^Hi there,/);
  assert.match(email.text, /• An authenticator app, /);
  assert.match(email.text, /• A passkey \("YubiKey"\), /);
});

test("a device name is escaped and shortened: whoever added it chose it", () => {
  const email = buildSecurityAlertEmail({
    name: "<b>Alex</b>",
    origin,
    items: [{ kind: "passkey", label: '<a href="https://example.com">click</a>', at }],
  });
  assert.doesNotMatch(email.html, /<a href="https:\/\/example\.com">/);
  assert.match(email.html, /&lt;a href=&quot;https:\/\/example\.com&quot;&gt;/);
  assert.doesNotMatch(email.html, /<b>Alex<\/b>/);
  assert.equal(alertLabel("x".repeat(80))?.length, 60);
  assert.equal(alertLabel("  spaced \n  name "), "spaced name");
  assert.equal(alertLabel("   "), null);
});

test("times are given in UTC, since the server cannot know the reader's zone", () => {
  assert.equal(alertTime(at), "Jan 2, 2026, 2:05 PM UTC");
});

/* -------------------------------------------------------------- migration */

test("a passkey or verified second step added anywhere is queued, never blocking Supabase", () => {
  assert.match(migration, /after insert on auth\.webauthn_credentials/);
  assert.match(migration, /after insert or update of status on auth\.mfa_factors/);
  // Only when a factor becomes usable, and not for recovery-code rows.
  assert.match(migration, /new\.status::text <> 'verified' or new\.factor_type::text not in \('totp', 'webauthn', 'phone'\)/);
  // `old` is only read on UPDATE: an INSERT has none.
  assert.match(migration, /if tg_op = 'UPDATE' then\s+if old\.status::text = 'verified' then/);
  // A failed insert is swallowed so the passkey or factor is still saved.
  assert.equal(migration.match(/exception when others then/g)?.length, 2);
  assert.equal(migration.match(/security definer\s+set search_path = ''/g)?.length, 2);
});

test("the queue is closed to the Data API", () => {
  assert.match(migration, /alter table public\.security_alerts enable row level security;/);
  assert.match(migration, /revoke all on public\.security_alerts from anon, authenticated;/);
  assert.match(migration, /revoke all on function public\.queue_passkey_alert\(\) from public;/);
  assert.match(migration, /revoke all on function public\.queue_factor_alert\(\) from public;/);
});

/* --------------------------------------------------------------- delivery */

test("each alert is claimed before it is sent, so two senders cannot both send it", () => {
  assert.match(delivery, /set sent_at = now\(\)/);
  assert.match(delivery, /for update skip locked/);
  assert.ok(delivery.indexOf("set sent_at = now()") < delivery.indexOf("await notifyOwner("));
});

test("alerts are sent after adding a passkey or app on the site, on sign-in, and daily", () => {
  const passkeys = read("../actions/passkeys.ts");
  const finish = passkeys.slice(passkeys.indexOf("export async function finishPasskeyRegistrationAction"));
  assert.match(finish.slice(0, finish.indexOf("\n}\n")), /scheduleSecurityAlerts\(actor\.user\.id\);/);

  const twoFactor = read("../actions/two-factor.ts");
  const confirm = twoFactor.slice(twoFactor.indexOf("export async function confirmTwoFactorSetupAction"));
  assert.match(confirm.slice(0, confirm.indexOf("\n}\n")), /scheduleSecurityAlerts\(actor\.user\.id\);/);

  const auto = read("../notifications-auto.ts");
  const signIn = auto.slice(auto.indexOf("export async function dispatchSignInNotifications"));
  assert.match(signIn.slice(0, signIn.indexOf("\n}\n")), /scheduleSecurityAlerts\(userId\);/);

  const cron = read("../../app/api/cron/security-alerts/route.ts");
  assert.match(cron, /const denied = cronAuthError\(request\);/);
  assert.match(read("../../../vercel.json"), /"path": "\/api\/cron\/security-alerts"/);
});
