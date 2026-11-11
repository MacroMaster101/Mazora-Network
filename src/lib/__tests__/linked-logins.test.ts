import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as linkedLoginsCore from "@/lib/auth/linked-logins-core";
import * as resetGrantCore from "@/lib/auth/reset-grant-core";
import { loadServerModule } from "./helpers/server-module";
import type * as LinkedLogins from "@/lib/auth/linked-logins";
import type * as LinkPendingGrant from "@/lib/auth/link-pending-grant";
import {
  LINK_PENDING_MS,
  pendingLinkNonce,
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

test("a pending link carries its nonce only while it may still arrive", () => {
  const live = { link_pending: { provider: "discord", until: NOW + 60_000, nonce: "fake-nonce-1" } };
  assert.equal(pendingLinkNonce(live, NOW), "fake-nonce-1");
  assert.equal(pendingLinkNonce({ link_pending: { ...live.link_pending, until: NOW } }, NOW), null, "expired");
  // One written without a nonce names no browser, so it lets nobody's login be trusted.
  assert.equal(pendingLinkNonce({ link_pending: { provider: "discord", until: NOW + 60_000 } }, NOW), null);
  assert.equal(pendingLinkNonce({ link_pending: { provider: "discord", until: NOW + 60_000, nonce: 7 } }, NOW), null);
  assert.equal(pendingLinkNonce({ link_pending: { provider: "discord", until: NOW + 60_000, nonce: "" } }, NOW), null);
  assert.equal(pendingLinkNonce({}, NOW), null);
  assert.equal(pendingLinkNonce(undefined, NOW), null);
});

/* ------------------------------------------- the browser that started it */

const OWNER_ID = "00000000-0000-3000-8000-000000000099";
const OTHER_ACCOUNT_ID = "00000000-0000-3000-8000-000000000098";
const LINK_COOKIE = "mz_link_pending";

/** The real link flow with a fake cookie jar and a database that only records. */
function linkFixture(env: Record<string, string> = { NODE_ENV: "development" }) {
  const jar = new Map<string, string>();
  const sets: Array<{ name: string; options: Record<string, unknown> }> = [];
  const deleted: unknown[] = [];
  const cookieStore = {
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.set(name, value);
      sets.push({ name, options });
    },
    delete: (target: string | { name: string; path?: string }) => {
      deleted.push(target);
      jar.delete(typeof target === "string" ? target : target.name);
    },
  };
  let writes = 0;
  const grant = loadServerModule<typeof LinkPendingGrant>(new URL("../auth/link-pending-grant.ts", import.meta.url), {
    env,
    mocks: {
      "next/headers": { cookies: async () => cookieStore },
      "@/lib/supabase/secret-key": { supabaseSecretKey: () => "fake-secret-for-tests" },
      "@/lib/auth/reset-grant-core": resetGrantCore,
      "@/lib/auth/linked-logins-core": linkedLoginsCore,
    },
  });
  const links = loadServerModule<typeof LinkedLogins>(new URL("../auth/linked-logins.ts", import.meta.url), {
    env,
    mocks: {
      "@/lib/db/client": { getDb: () => ({ execute: async () => { writes += 1; return []; } }) },
      "@/lib/rate-limit": { claimOnce: async () => "claimed" },
      "@/lib/data/account-status": { endAllSessions: async () => {} },
      "@/lib/audit-log": { recordAudit: async () => {} },
      "@/lib/security-alerts": { notifyLinkedLoginRemoved: async () => {} },
      "@/lib/auth/linked-logins-core": linkedLoginsCore,
      "@/lib/auth/link-pending-grant": grant,
    },
  });
  /** The nonce the cookie was signed for: what markLinkPending wrote into the pending link. */
  const nonceInCookie = () => JSON.parse(Buffer.from(jar.get(LINK_COOKIE)!.split(".")[0], "base64url").toString("utf8")).s as string;
  /** The account as the callback reads it: a pending Discord link and one new Discord login. */
  const arriving = (nonce: string | undefined, id = OWNER_ID) => ({
    id,
    ...account({ trusted_identities: [], link_pending: { provider: "discord", until: Date.now() + 60_000, ...(nonce ? { nonce } : {}) } }, [
      emailLogin,
      identity("discord", DISCORD_ID),
    ]),
  });
  // A plain copy: a list made inside the module sandbox has its prototypes.
  const trustedOn = (user: { app_metadata: unknown }) => [...(user.app_metadata as { trusted_identities: string[] }).trusted_identities];
  return { links, grant, jar, sets, deleted, writes: () => writes, nonceInCookie, arriving, trustedOn };
}

test("starting a link leaves a signed, short-lived cookie that only the callback receives", async () => {
  const { links, sets, writes, nonceInCookie } = linkFixture({ NODE_ENV: "production" });
  assert.equal(await links.markLinkPending(OWNER_ID, "discord"), true);
  assert.equal(writes(), 1, "the pending link is written with it");
  assert.equal(sets.length, 1);
  assert.equal(sets[0].name, LINK_COOKIE);
  // Lax, not Strict: it must come back on the redirect from the provider.
  assert.deepEqual(JSON.parse(JSON.stringify(sets[0].options)), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/auth/callback",
    maxAge: LINK_PENDING_MS / 1000,
  });
  assert.ok(nonceInCookie().length >= 22, "an unguessable nonce");

  const second = linkFixture();
  await second.links.markLinkPending(OWNER_ID, "discord");
  assert.notEqual(second.nonceInCookie(), nonceInCookie(), "a new one for every link");
});

test("the callback trusts the new login only in the browser that started the link", async () => {
  const { links, jar, deleted, writes, nonceInCookie, arriving, trustedOn } = linkFixture();
  await links.markLinkPending(OWNER_ID, "discord");
  const nonce = nonceInCookie();
  const ownerCookie = jar.get(LINK_COOKIE)!;
  const before = writes();

  // A copied session reaches the callback first, from a browser that started nothing.
  jar.delete(LINK_COOKIE);
  const stranger = arriving(nonce);
  await links.settlePendingLink(stranger);
  assert.deepEqual(trustedOn(stranger), [], "its login is not trusted");
  assert.equal(writes(), before, "and nothing is written: the pending link stays for the owner");

  // Knowing the nonce (it is readable in the session's app_metadata) is not enough:
  // a cookie signed for it with any other key does not verify.
  const wrongKey = resetGrantCore.deriveGrantKey("fake-secret-for-tests", "owner-confirmed");
  jar.set(LINK_COOKIE, resetGrantCore.signSessionGrant({ userId: OWNER_ID, sessionId: nonce }, wrongKey, Math.floor(Date.now() / 1000), 600));
  await links.settlePendingLink(stranger);
  assert.deepEqual(trustedOn(stranger), []);
  jar.set(LINK_COOKIE, "not-a-cookie");
  await links.settlePendingLink(stranger);
  assert.deepEqual(trustedOn(stranger), []);
  assert.equal(writes(), before);

  // The owner's cookie proves nothing for another link, another account, or a link with no nonce.
  jar.set(LINK_COOKIE, ownerCookie);
  for (const user of [arriving("fake-nonce-of-a-later-link"), arriving(nonce, OTHER_ACCOUNT_ID), arriving(undefined)]) {
    await links.settlePendingLink(user);
    assert.deepEqual(trustedOn(user), []);
  }
  assert.equal(writes(), before);

  // The owner's own callback.
  const owner = arriving(nonce);
  await links.settlePendingLink(owner);
  assert.deepEqual(trustedOn(owner), [DISCORD_ID]);
  assert.equal(writes(), before + 1, "trusted, and the pending link ended");
  assert.equal(jar.has(LINK_COOKIE), false, "the cookie is spent");
  assert.deepEqual(JSON.parse(JSON.stringify(deleted[deleted.length - 1])), { name: LINK_COOKIE, path: "/auth/callback" });
});

test("with the owner's cookie, two new logins of the pending provider are still both left untrusted", async () => {
  const { links, writes, nonceInCookie, arriving, trustedOn } = linkFixture();
  await links.markLinkPending(OWNER_ID, "discord");
  const user = arriving(nonceInCookie());
  user.identities = [...(user.identities ?? []), identity("discord", OTHER_DISCORD_ID)];
  const before = writes();
  await links.settlePendingLink(user);
  assert.deepEqual(trustedOn(user), []);
  assert.equal(writes(), before);
});

test("a link that cannot be bound to the browser does not start", async () => {
  const jar = new Map<string, string>();
  const grant = loadServerModule<typeof LinkPendingGrant>(new URL("../auth/link-pending-grant.ts", import.meta.url), {
    mocks: {
      "next/headers": { cookies: async () => ({ get: () => undefined, set: (name: string, value: string) => jar.set(name, value), delete() {} }) },
      // No signing secret configured.
      "@/lib/supabase/secret-key": { supabaseSecretKey: () => undefined },
      "@/lib/auth/reset-grant-core": resetGrantCore,
      "@/lib/auth/linked-logins-core": linkedLoginsCore,
    },
  });
  assert.equal(await grant.issueLinkNonce(OWNER_ID), null);
  assert.equal(jar.size, 0);
  assert.equal(await grant.holdsLinkNonce(OWNER_ID, "fake-nonce-1"), false);

  const source = read("../auth/linked-logins.ts");
  const mark = source.slice(source.indexOf("export async function markLinkPending"), source.indexOf("export async function settlePendingLink"));
  const issue = mark.indexOf("const nonce = await issueLinkNonce(userId);");
  const refuse = mark.indexOf("return false;", issue);
  const write = mark.indexOf("update auth.users");
  assert.ok(issue > 0 && refuse > issue && write > refuse, "no pending link is written without the cookie");
  assert.match(mark, /'nonce', \$\{nonce\}::text/);
});

test("the cookie has its own purpose key and the check comes before anything is trusted", () => {
  const grant = read("../auth/link-pending-grant.ts");
  assert.match(grant, /deriveGrantKey\(secret, "link-pending"\)/);
  assert.match(grant, /signSessionGrant\(\{ userId, sessionId: nonce \}, k, nowSeconds\(\), TTL_SECONDS\)/);
  assert.match(grant, /verifySessionGrant\(\(await cookies\(\)\)\.get\(COOKIE\)\?\.value, \{ userId, sessionId: nonce \}, k, nowSeconds\(\)\)/);
  assert.doesNotMatch(grant, /^["']use server["'];?\s*$/m, "not a server-action file");

  const source = read("../auth/linked-logins.ts");
  const settle = source.slice(source.indexOf("export async function settlePendingLink"));
  const held = settle.indexOf("await holdsLinkNonce(user.id, pendingLinkNonce(");
  const stop = settle.indexOf("if (!startedHere) return;");
  const which = settle.indexOf("pendingLinkToTrust(user, now)");
  const trust = settle.indexOf("await addTrusted(user.id, [id], true);");
  assert.ok(held > 0 && stop > held && which > stop && trust > which);
  assert.equal((source.match(/addTrusted\(user\.id, \[id\], true\)/g) ?? []).length, 1, "the only place a pending link is trusted");
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
