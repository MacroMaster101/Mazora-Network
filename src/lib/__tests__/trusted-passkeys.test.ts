import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  PASSKEY_PENDING_MS,
  parsePasskeyState,
  passkeyPendingUntil,
  reviewPasskeys,
  trustedPasskeyIds,
  type PasskeyState,
} from "@/lib/auth/trusted-passkeys-core";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const NOW = Date.parse("2026-01-02T14:05:00Z");
const LAPTOP_KEY = "00000000-0000-3000-8000-000000000001";
const PHONE_KEY = "00000000-0000-3000-8000-000000000002";
const STRAY_KEY = "00000000-0000-3000-8000-000000000003";

function state(trusted: string[] | null, passkeys: string[], pendingUntil: number | null = null): PasskeyState {
  return { trusted, pendingUntil, passkeys, now: NOW };
}

/** The text of one function in a source file, up to the next top-level declaration. */
function fn(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start > -1, `${signature} exists`);
  const next = source.slice(start + 1).search(/\n(?:export |async function |function |\/\*\*)/);
  return source.slice(start, next === -1 ? undefined : start + 1 + next);
}

/* ------------------------------------------------------------------ rules */

test("an account with no list yet is baselined, whatever it has", () => {
  assert.deepEqual(reviewPasskeys(state(null, [LAPTOP_KEY, PHONE_KEY])), { baseline: true });
  assert.deepEqual(reviewPasskeys(state(null, [])), { baseline: true });
  assert.equal(trustedPasskeyIds(undefined), null);
  assert.equal(trustedPasskeyIds({}), null);
  assert.equal(trustedPasskeyIds({ trusted_passkeys: null }), null);
  assert.equal(trustedPasskeyIds({ trusted_passkeys: "not a list" }), null);
  assert.deepEqual(trustedPasskeyIds({ trusted_passkeys: [LAPTOP_KEY, 7] }), [LAPTOP_KEY]);
});

test("an empty list is a list: it is not baselined again", () => {
  assert.deepEqual(trustedPasskeyIds({ trusted_passkeys: [] }), []);
  assert.deepEqual(reviewPasskeys(state([], [])), { baseline: false, remove: [] });
});

test("trusted passkeys are left alone, and an id left on the list harms nothing", () => {
  assert.deepEqual(reviewPasskeys(state([LAPTOP_KEY, PHONE_KEY], [LAPTOP_KEY, PHONE_KEY])), { baseline: false, remove: [] });
  assert.deepEqual(reviewPasskeys(state([LAPTOP_KEY, PHONE_KEY], [PHONE_KEY])), { baseline: false, remove: [] });
});

test("a passkey nobody added through the site is removed, and only that one", () => {
  assert.deepEqual(reviewPasskeys(state([LAPTOP_KEY], [LAPTOP_KEY, STRAY_KEY])), { baseline: false, remove: [STRAY_KEY] });
  assert.deepEqual(reviewPasskeys(state([], [STRAY_KEY])), { baseline: false, remove: [STRAY_KEY] });
});

test("ids are compared without regard to case", () => {
  const upper = "ABCDEF00-0000-3000-8000-00000000000A";
  const parsed = parsePasskeyState({ trusted: [upper], pending: null, passkeys: [upper.toLowerCase()], now: NOW });
  assert.ok(parsed);
  assert.deepEqual(reviewPasskeys(parsed), { baseline: false, remove: [] });
});

test("nothing is removed while the site is adding a passkey", () => {
  const adding = state([LAPTOP_KEY], [LAPTOP_KEY, PHONE_KEY], NOW + 1);
  assert.deepEqual(reviewPasskeys(adding), { baseline: false, remove: [] });
  assert.equal(PASSKEY_PENDING_MS, 2 * 60_000);
});

test("an add that has run out protects nothing", () => {
  const expired = state([LAPTOP_KEY], [LAPTOP_KEY, STRAY_KEY], NOW);
  assert.deepEqual(reviewPasskeys(expired), { baseline: false, remove: [STRAY_KEY] });
  assert.equal(passkeyPendingUntil({ passkey_pending: { until: "soon" } }), null);
  assert.equal(passkeyPendingUntil({ passkey_pending: "yes" }), null);
  assert.equal(passkeyPendingUntil({}), null);
  assert.equal(passkeyPendingUntil({ passkey_pending: { until: NOW + 5 } }), NOW + 5);
});

test("an add in progress never stands in for a list", () => {
  assert.deepEqual(reviewPasskeys(state(null, [LAPTOP_KEY], NOW + 60_000)), { baseline: true });
});

/* ---------------------------------------------------------------- the read */

test("the row read from the database becomes the account's state", () => {
  const row = { trusted: [LAPTOP_KEY], pending: { until: NOW + 1000 }, passkeys: [LAPTOP_KEY, PHONE_KEY], now: NOW };
  assert.deepEqual(parsePasskeyState(row), { trusted: [LAPTOP_KEY], pendingUntil: NOW + 1000, passkeys: [LAPTOP_KEY, PHONE_KEY], now: NOW });
  // The same row from a driver that hands JSON and numbers back as text.
  const asText = { trusted: JSON.stringify([LAPTOP_KEY]), pending: JSON.stringify({ until: NOW + 1000 }), passkeys: JSON.stringify([LAPTOP_KEY, PHONE_KEY]), now: String(NOW) };
  assert.deepEqual(parsePasskeyState(asText), parsePasskeyState(row));
});

test("an account with no list reads as never baselined, not as trusting nothing", () => {
  const parsed = parsePasskeyState({ trusted: null, pending: null, passkeys: [LAPTOP_KEY], now: NOW });
  assert.ok(parsed);
  assert.equal(parsed.trusted, null);
  assert.deepEqual(reviewPasskeys(parsed), { baseline: true });
});

test("a read that is not what was asked for decides nothing", () => {
  assert.equal(parsePasskeyState(undefined), null, "no such account, or no row came back");
  assert.equal(parsePasskeyState(null), null);
  assert.equal(parsePasskeyState("row"), null);
  assert.equal(parsePasskeyState({ trusted: [], pending: null, now: NOW }), null, "no passkeys column");
  assert.equal(parsePasskeyState({ trusted: [], pending: null, passkeys: null, now: NOW }), null);
  assert.equal(parsePasskeyState({ trusted: [], pending: null, passkeys: "not json", now: NOW }), null);
  assert.equal(parsePasskeyState({ trusted: [], pending: null, passkeys: [LAPTOP_KEY, 7], now: NOW }), null);
  assert.equal(parsePasskeyState({ trusted: [], pending: null, passkeys: [LAPTOP_KEY] }), null, "no clock");
  assert.equal(parsePasskeyState({ trusted: [], pending: null, passkeys: [LAPTOP_KEY], now: "later" }), null);
  assert.equal(parsePasskeyState({ trusted: [], pending: null, passkeys: [LAPTOP_KEY], now: 0 }), null);
});

/* --------------------------------------------------------------- wiring */

const server = read("../auth/trusted-passkeys.ts");
const actions = read("../actions/passkeys.ts");

test("every signed-in request checks the account's passkeys before trusting the session", () => {
  const source = read("../auth/index.ts");
  const linked = source.indexOf("checkLinkedLogins(data.user)");
  const check = source.indexOf('if ((await checkTrustedPasskeys(data.user)) === "removed") return null;');
  assert.ok(check > linked && linked > 0, "getAuthState calls checkTrustedPasskeys beside checkLinkedLogins");
  assert.ok(check < source.indexOf("accessTokenClaims(", check), "before the session's claims are read");
});

test("the list, the add in progress and the passkeys are read in one statement", () => {
  const readState = fn(server, "async function readPasskeyState");
  assert.equal((readState.match(/db\.execute\(/g) ?? []).length, 1);
  assert.match(readState, /raw_app_meta_data -> 'trusted_passkeys' as trusted/);
  assert.match(readState, /raw_app_meta_data -> 'passkey_pending' as pending/);
  assert.match(readState, /\$\{CURRENT\} as passkeys/);
  assert.match(server, /from auth\.webauthn_credentials w where w\.user_id = u\.id/);
  assert.match(readState, /if \(!db\) return null;/, "no database is unknown, not empty");
  assert.match(readState, /return parsePasskeyState\(rows\?\.\[0\]\);/);
});

test("a failed or unreadable read leaves the session and the passkeys alone", () => {
  const check = fn(server, "export async function checkTrustedPasskeys");
  const guarded = check.slice(0, check.indexOf("claimOnce("));
  assert.match(guarded, /if \(!state\) return "ok";/);
  assert.match(guarded, /catch \(error\) \{\s*console\.error\("Passkeys could not be checked", error\);\s*return "ok";/);
  assert.doesNotMatch(guarded, /removePasskeys\(|endAllSessions\(/, "nothing is removed before the read has answered");
  assert.ok(check.indexOf("readPasskeyState(user.id)") < check.indexOf("removePasskeys("));
});

test("an account without a list is baselined, and a list is never overwritten", () => {
  const check = fn(server, "export async function checkTrustedPasskeys");
  assert.match(check, /if \(review\.baseline\) \{\s*await writeBaseline\(user\.id\);\s*return "ok";/);
  const baseline = fn(server, "async function writeBaseline");
  assert.match(baseline, /\(u\.raw_app_meta_data -> 'trusted_passkeys'\) is null/);
});

test("the delete decides again for itself, in the same statement", () => {
  const remove = fn(server, "async function removePasskeys");
  assert.equal((remove.match(/db\.execute\(/g) ?? []).length, 1);
  assert.match(remove, /delete from auth\.webauthn_credentials w\s+using auth\.users u/);
  assert.match(remove, /w\.user_id = u\.id/, "only this account's passkeys");
  assert.match(remove, /and \$\{HAS_LIST\}/, "never for an account without a list");
  assert.match(remove, /w\.id::text not in \(select lower\(value\) from jsonb_array_elements_text\(u\.raw_app_meta_data -> 'trusted_passkeys'\)\)/);
  assert.match(remove, /'passkey_pending' ->> 'until'\)::numeric end,\s*0\) <= \$\{NOW_MS\}/, "never while the site is adding one");
  assert.match(remove, /returning w\.id/, "only the passkeys actually removed");
  assert.match(server, /const HAS_LIST = sql`jsonb_typeof\(u\.raw_app_meta_data -> 'trusted_passkeys'\) = 'array'`;/);
});

test("removing a passkey ends every session, and a passkey trusted meanwhile is not refused", () => {
  const check = fn(server, "export async function checkTrustedPasskeys");
  const removed = check.indexOf("await removePasskeys(user.id, remove)");
  const nothing = check.indexOf("if (removed.length === 0)");
  const ended = check.indexOf("await endAllSessions(user.id)");
  assert.ok(removed > 0 && nothing > removed && ended > nothing, "sessions end only after something was removed");
  const branch = check.slice(nothing, ended);
  assert.match(branch, /second\.remove\.length === 0 && stillThere\) return "ok";/);
  assert.match(branch, /return "removed";/, "one another request removed is still refused");
  const after = check.slice(ended);
  assert.match(after, /action: "auth\.passkey_unrecognised_removed"/);
  assert.match(after, /notifyLinkedLoginRemoved\(user\.id, \["passkey"\]\)/);
  assert.match(check, /claimOnce\(`untrusted-passkey-removal:\$\{user\.id\}`, 60_000\)/);
  assert.match(check.slice(check.lastIndexOf("catch (error)")), /return "removed";\s*\}\s*$/);
});

test("a removed passkey's queued alert is closed without being able to stop the removal", () => {
  const close = fn(server, "async function closeQueuedAlerts");
  assert.match(close, /update public\.security_alerts/);
  assert.match(close, /sent_at is null/, "an alert already sent is left as it was");
  assert.match(close, /catch \(error\)/, "a failure stays here");
});

test("adding a passkey records the add before Supabase stores anything, then trusts exactly that passkey", () => {
  const finish = fn(actions, "export async function finishPasskeyRegistrationAction");
  const owner = finish.indexOf("ownerConfirmed(actor)");
  const pending = finish.indexOf("if (!(await markPasskeyPending(actor.user.id))) return { ok: false, message: NOT_SAVED };");
  const stored = finish.indexOf("passkey.verifyRegistration(");
  const trusted = finish.indexOf("trustPasskey(actor.user.id, data.id)");
  const audited = finish.indexOf('action: "auth.passkey_added"');
  assert.ok(owner > 0 && pending > owner, "only after the owner pass");
  assert.ok(stored > pending, "nothing is stored when the add cannot be recorded");
  assert.ok(trusted > stored && trusted < audited, "the id is written before the add is reported as done");
});

test("the add in progress gives an account without a list its baseline, and keeps a list it has", () => {
  const mark = fn(server, "export async function markPasskeyPending");
  assert.match(mark, /if \(!db\) return false;/);
  assert.match(mark, /'trusted_passkeys', case when \$\{HAS_LIST\} then u\.raw_app_meta_data -> 'trusted_passkeys' else \$\{CURRENT\} end/);
  assert.match(mark, /'passkey_pending', jsonb_build_object\('until', \(\$\{NOW_MS\}\)::bigint \+ \$\{PASSKEY_PENDING_MS\}::bigint\)/);
  assert.match(mark, /return \(rows\?\.length \?\? 0\) === 1;/, "an account that was not updated is not marked");
  assert.match(mark, /catch \(error\) \{[\s\S]*return false;/);
});

test("trusting a passkey adds to the list and never ends the add in progress", () => {
  const trust = fn(server, "export async function trustPasskey");
  assert.match(trust, /!UUID\.test\(id\)\) return false;/);
  assert.match(trust, /case when \$\{HAS_LIST\} then u\.raw_app_meta_data -> 'trusted_passkeys' else \$\{CURRENT\} end/);
  assert.match(trust, /attempt <= 3/, "tried again before giving up");
  // Another tab's add may still be between storing its passkey and trusting it.
  assert.doesNotMatch(server, /- 'passkey_pending'/);
});

test("a passkey whose id could not be written is taken back off, and the member is told", () => {
  const finish = fn(actions, "export async function finishPasskeyRegistrationAction");
  const failed = finish.indexOf("if (!(await trustPasskey(actor.user.id, data.id))) {");
  assert.ok(failed > 0);
  const branch = finish.slice(failed, finish.indexOf('action: "auth.passkey_added"'));
  assert.match(branch, /passkey\.delete\(\{ passkeyId: data\.id \}\)/);
  assert.match(branch, /if \(!undoError\) return \{ ok: false, message: NOT_SAVED \};/);
  assert.match(branch, /it will be removed and you will be signed out/, "and when even that fails, what happens next is said");
  assert.doesNotMatch(branch, /ok: true/);
});

test("removing a passkey on the site takes it off the list afterwards, never before", () => {
  const remove = fn(actions, "export async function deletePasskeyAction");
  const deleted = remove.indexOf("passkey.delete({ passkeyId: passkeyId.data })");
  const forgotten = remove.indexOf("await forgetPasskey(actor.user.id, passkeyId.data);");
  assert.ok(deleted > 0 && forgotten > deleted);
  assert.ok(remove.indexOf("if (error) return") < forgotten, "only once Supabase has removed it");
  const forget = fn(server, "export async function forgetPasskey");
  assert.match(forget, /where lower\(value\) <> \$\{id\}::text/);
  assert.match(forget, /and \$\{HAS_LIST\}/, "an account without a list is not given one by a removal");
});

test("a passkey sign-in is refused before it counts when the account has an untrusted passkey", () => {
  const finish = fn(actions, "export async function finishPasskeySignInAction");
  const verified = finish.indexOf("passkey.verifyAuthentication(");
  const check = finish.indexOf('if ((await checkTrustedPasskeys(signedIn.user)) === "removed") {');
  assert.ok(verified > 0 && check > verified);
  assert.ok(check < finish.indexOf("rememberLoginDevice("), "before the device is remembered");
  assert.ok(check < finish.indexOf("issuePasskeySignInGrant("), "before the second step can be passed");
  assert.ok(check < finish.indexOf("dispatchSignInNotifications("), "before the sign-in is announced");
  assert.match(finish.slice(check, check + 200), /await endLocalSession\(supabase\);\s*return \{ ok: false, message: PASSKEY_REMOVED \};/);
});

test("only the site's own server writes the list", () => {
  assert.match(server, /^import "server-only";/);
  for (const path of ["../auth/trusted-passkeys.ts", "../auth/trusted-passkeys-core.ts", "../actions/passkeys.ts"]) {
    assert.doesNotMatch(read(path), /user_metadata/, `${path} keeps nothing where the member can write`);
  }
});

/* ------------------------------------------------------------- migration */

test("migration 089 baselines accounts without a list and keeps existing lists", () => {
  const sql = read("../../../supabase/migrations/089_trusted_passkeys.sql");
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.match(statements, /^\s*begin;/);
  assert.match(statements, /commit;\s*$/);
  assert.match(statements, /from auth\.webauthn_credentials w\s+where w\.user_id = u\.id/);
  assert.match(statements, /coalesce\(jsonb_agg\(w\.id::text\), '\[\]'::jsonb\)/, "an account with no passkeys gets an empty list");
  assert.match(statements, /where \(u\.raw_app_meta_data -> 'trusted_passkeys'\) is null;/);
  // One statement, guarded by the list being absent: running it twice changes nothing.
  assert.equal((statements.match(/;/g) ?? []).length, 3);
  assert.doesNotMatch(statements, /\b(?:delete|drop|truncate)\b/i);
});
