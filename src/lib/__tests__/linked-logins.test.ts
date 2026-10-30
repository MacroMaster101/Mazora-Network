import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LINK_PENDING_MS,
  pendingLinkProvider,
  pendingLinkToTrust,
  providerName,
  reviewLinkedLogins,
  trustedIdentityIds,
  type LinkedLoginUser,
} from "@/lib/auth/linked-logins-core";
import { buildLinkedLoginRemovedEmail, isSecurityAlertKind } from "@/lib/email/security-alert-email";
import { summarise } from "@/lib/audit-subject";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const NOW = Date.parse("2026-01-02T14:05:00Z");
const EMAIL_ID = "00000000-0000-3000-8000-000000000001";
const GOOGLE_ID = "00000000-0000-3000-8000-000000000002";
const DISCORD_ID = "00000000-0000-3000-8000-000000000003";
const OTHER_DISCORD_ID = "00000000-0000-3000-8000-000000000004";

type Identity = NonNullable<LinkedLoginUser["identities"]>[number];

function identity(provider: string, identityId: string, data: Record<string, unknown> = {}): Identity {
  return {
    id: `provider-user-${identityId.slice(-1)}`,
    identity_id: identityId,
    user_id: "00000000-0000-3000-8000-000000000099",
    provider,
    identity_data: data,
  } as Identity;
}

function account(meta: Record<string, unknown> | undefined, identities: Identity[], email = "steve_42@example.com"): LinkedLoginUser {
  return {
    email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: (meta ?? {}) as LinkedLoginUser["app_metadata"],
    identities,
  };
}

const emailLogin = identity("email", EMAIL_ID, { email: "steve_42@example.com", email_verified: true });

/* ------------------------------------------------------------------ rules */

test("an account with no list yet is baselined, whatever it has", () => {
  const user = account(undefined, [emailLogin, identity("google", GOOGLE_ID)]);
  assert.deepEqual(reviewLinkedLogins(user, NOW), { baseline: true });
  assert.equal(trustedIdentityIds({ trusted_identities: "not a list" }), null);
  assert.deepEqual(trustedIdentityIds({ trusted_identities: [GOOGLE_ID, 7] }), [GOOGLE_ID]);
});

test("trusted logins and the account's own email are left alone", () => {
  const user = account({ trusted_identities: [GOOGLE_ID] }, [emailLogin, identity("google", GOOGLE_ID)]);
  assert.deepEqual(reviewLinkedLogins(user, NOW), { baseline: false, trust: [], remove: [] });
});

test("a login nobody added through the site is removed", () => {
  const user = account({ trusted_identities: [] }, [emailLogin, identity("discord", DISCORD_ID, { email: "alex_builder@example.com", email_verified: true })]);
  assert.deepEqual(reviewLinkedLogins(user, NOW), { baseline: false, trust: [], remove: [{ id: DISCORD_ID, provider: "discord" }] });
});

test("a provider vouching for the account's own confirmed address is trusted", () => {
  const google = identity("google", GOOGLE_ID, { email: " Steve_42@Example.com ", email_verified: true });
  const user = account({ trusted_identities: [] }, [emailLogin, google]);
  assert.deepEqual(reviewLinkedLogins(user, NOW), { baseline: false, trust: [GOOGLE_ID], remove: [] });
});

test("the same address unverified by the provider is not trusted", () => {
  const discord = identity("discord", DISCORD_ID, { email: "steve_42@example.com", email_verified: false });
  const user = account({ trusted_identities: [] }, [emailLogin, discord]);
  const review = reviewLinkedLogins(user, NOW);
  assert.ok(!review.baseline);
  assert.deepEqual(review.remove, [{ id: DISCORD_ID, provider: "discord" }]);
});

test("the same address is not trusted while the account's own email is unconfirmed", () => {
  const google = identity("google", GOOGLE_ID, { email: "steve_42@example.com", email_verified: true });
  const user = { ...account({ trusted_identities: [] }, [emailLogin, google]), email_confirmed_at: undefined };
  const review = reviewLinkedLogins(user, NOW);
  assert.ok(!review.baseline);
  assert.deepEqual(review.remove, [{ id: GOOGLE_ID, provider: "google" }]);
});

test("a link started on the site waits for the callback, and only for that provider", () => {
  const meta = { trusted_identities: [], link_pending: { provider: "discord", until: NOW + 60_000 } };
  const user = account(meta, [emailLogin, identity("discord", DISCORD_ID), identity("google", GOOGLE_ID)]);
  const review = reviewLinkedLogins(user, NOW);
  assert.ok(!review.baseline);
  assert.deepEqual(review.remove, [{ id: GOOGLE_ID, provider: "google" }]);
  assert.equal(pendingLinkToTrust(user, NOW), DISCORD_ID);
});

test("an expired pending link protects nothing", () => {
  const meta = { trusted_identities: [], link_pending: { provider: "discord", until: NOW } };
  const user = account(meta, [emailLogin, identity("discord", DISCORD_ID)]);
  assert.equal(pendingLinkProvider(meta, NOW), null);
  assert.equal(pendingLinkToTrust(user, NOW), null);
  const review = reviewLinkedLogins(user, NOW);
  assert.ok(!review.baseline);
  assert.deepEqual(review.remove, [{ id: DISCORD_ID, provider: "discord" }]);
  assert.equal(LINK_PENDING_MS, 10 * 60_000);
});

test("two new logins of the pending provider means neither is trusted", () => {
  const meta = { trusted_identities: [], link_pending: { provider: "discord", until: NOW + 60_000 } };
  const user = account(meta, [emailLogin, identity("discord", DISCORD_ID), identity("discord", OTHER_DISCORD_ID)]);
  assert.equal(pendingLinkToTrust(user, NOW), null);
});

test("a pending link is never trusted before the account has a list", () => {
  const user = account({ link_pending: { provider: "google", until: NOW + 60_000 } }, [emailLogin, identity("google", GOOGLE_ID)]);
  assert.equal(pendingLinkToTrust(user, NOW), null);
});

test("provider names are readable and never carry markup", () => {
  assert.equal(providerName("google"), "Google");
  assert.equal(providerName("discord"), "Discord");
  assert.equal(providerName("github"), "Github");
  assert.equal(providerName("<b>x</b>"), "Bxb");
  assert.equal(providerName("!!!"), "Provider");
});

/* ------------------------------------------------------------- messages */

test("the removal email says what was removed and what to do", () => {
  const email = buildLinkedLoginRemovedEmail({ name: "Steve_42", origin: "https://example.com/", providers: ["google"], at: new Date(NOW) });
  assert.equal(email.subject, "We removed a Google login from your Mazora account");
  assert.match(email.text, /^Hi Steve_42,/);
  assert.match(email.text, /signed your account out on every device/);
  assert.match(email.text, /change your password/);
  assert.match(email.text, /Security settings: https:\/\/example\.com\/dashboard\/settings/);
  assert.match(email.html, /href="https:\/\/example\.com\/dashboard\/settings"/);
});

test("several removed logins read as a plural, and names are escaped", () => {
  const email = buildLinkedLoginRemovedEmail({ name: "<i>Alex</i>", origin: "https://example.com", providers: ["google", "discord"], at: new Date(NOW) });
  assert.equal(email.subject, "We removed Google and Discord logins from your Mazora account");
  assert.match(email.text, /Google and Discord logins were connected/);
  assert.ok(!email.html.includes("<i>Alex</i>"));
});

test("connected logins are alert kinds the delivery understands", () => {
  for (const kind of ["google", "discord", "identity"]) assert.ok(isSecurityAlertKind(kind), kind);
});

test("the audit log names the removed provider", () => {
  assert.equal(summarise("auth.linked_login_removed", "user", "id", { providers: ["discord"] }), "Unrecognised Discord login removed");
  assert.equal(summarise("auth.linked_login_removed", "user", "id", {}), "Unrecognised provider login removed");
});

test("the audit log says when a login could not be removed", () => {
  const summary = summarise("auth.linked_login_stuck", "user", "id", { providers: ["google"] }) ?? "";
  assert.match(summary, /Unrecognised Google login is the only one left/);
  assert.match(summary, /staff action needed/);
});

/* --------------------------------------------------------------- wiring */

test("every signed-in request checks the account's logins before trusting the session", () => {
  const source = read("../auth/index.ts");
  const check = source.indexOf("checkLinkedLogins(data.user)");
  assert.ok(check > 0, "getAuthState calls checkLinkedLogins");
  assert.ok(check < source.indexOf("accessTokenClaims(", check), "before the session's claims are read");
});

test("a login that cannot be removed is reported as stuck, not as removed", () => {
  const source = read("../auth/linked-logins.ts");
  const nothingRemoved = source.indexOf("if (providers.length === 0)");
  const stuck = source.indexOf('action: "auth.linked_login_stuck"');
  const removed = source.indexOf('action: "auth.linked_login_removed"');
  assert.ok(nothingRemoved > 0, "an empty removal is handled on its own");
  assert.ok(nothingRemoved < stuck && stuck < removed, "the stuck report comes first");
  const branch = source.slice(nothingRemoved, removed);
  assert.match(branch, /return "removed"/, "the session is still refused");
  assert.doesNotMatch(branch, /notifyLinkedLoginRemoved/, "the owner is not told it was removed");
  assert.match(branch, /claimOnce\(`linked-login-stuck:/, "and the report is rate limited");
});

test("a removed login's queued alert is closed without being able to stop the removal", () => {
  const source = read("../auth/linked-logins.ts");
  const close = source.slice(source.indexOf("async function closeQueuedAlerts"), source.indexOf("async function removeLogins"));
  assert.match(close, /update public\.security_alerts/);
  assert.match(close, /sent_at is null/, "an alert already sent is left as it was");
  assert.match(close, /catch \(error\)/, "a failure stays here");
  const remove = source.slice(source.indexOf("async function removeLogins"), source.indexOf("export async function checkLinkedLogins"));
  assert.match(remove, /closeQueuedAlerts\(userId, /);
  assert.match(remove, /returning i\.id, i\.provider/, "only the logins actually removed");
});

test("the callback trusts the site's own link before checking, and refuses a removed login", () => {
  const source = read("../../app/auth/callback/route.ts");
  const settle = source.indexOf("settlePendingLink(data.user)");
  const check = source.indexOf("checkLinkedLogins(data.user)");
  assert.ok(settle > 0 && check > settle);
  assert.ok(check < source.indexOf("rememberLoginDevice("), "before the sign-in is accepted");
  assert.match(source.slice(check, check + 400), /signOut\(\{ scope: "local" \}\)[\s\S]*login_removed/);
  assert.match(read("../../components/auth/auth-panels.tsx"), /login_removed:/);
});

test("both of the site's link flows mark the link pending first", () => {
  const source = read("../actions/auth.ts");
  const oauth = source.indexOf("markLinkPending(existingUser.user.id, provider)");
  assert.ok(oauth > 0 && oauth < source.indexOf("supabase.auth.linkIdentity({ provider", oauth));
  const sw = source.indexOf('markLinkPending(data.user.id, "discord")');
  assert.ok(sw > 0 && sw < source.indexOf("supabase.auth.unlinkIdentity(discordIdentity)", sw));
});

test("no admin metadata update spreads the old metadata back over newer changes", () => {
  // The auth server merges top-level keys itself; a spread rewrites keys read earlier.
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== "__tests__" && name !== "node_modules") walk(path);
      } else if (/\.tsx?$/.test(name)) files.push(path);
    }
  };
  walk(root);
  const offenders = files.filter((path) => {
    const source = readFileSync(path, "utf8");
    return source.includes("updateUserById") && /(app|user)_metadata:\s*\{\s*\.\.\./.test(source);
  });
  assert.deepEqual(offenders, []);
});

/* ------------------------------------------------------------- migration */

test("migration 085 alerts on added logins, never raises, and keeps existing lists", () => {
  const sql = read("../../../supabase/migrations/085_linked_logins.sql");
  assert.match(sql, /after insert on auth\.identities/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /exception when others then\s+raise warning/);
  assert.match(sql, /revoke all on function public\.queue_identity_alert\(\) from public/);
  assert.match(sql, /'google', 'discord', 'identity'/);
  assert.match(sql, /where \(u\.raw_app_meta_data -> 'trusted_identities'\) is null/);
});

test("migration 086 takes the identity alert trigger function away from the API roles", () => {
  // Supabase grants EXECUTE to anon and authenticated directly, so `public` alone is not enough.
  const sql = read("../../../supabase/migrations/086_identity_alert_grants.sql").replace(/--[^\n]*/g, "");
  assert.match(sql, /revoke execute on function public\.queue_identity_alert\(\) from public, anon, authenticated;/);
});
