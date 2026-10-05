import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  JUST_CONFIRMED_MARGIN_MS,
  SIGNUP_LINK_ELSEWHERE,
  UNPROVEN_SIGNUP_MESSAGE,
  UNPROVEN_SIGNUP_UNSECURED,
  authCookieNames,
  classifyPasswordProbe,
  confirmedBeforeVerifying,
  emailStanding,
  firstSignupConfirmation,
  mayReplacePending,
  neutralProfileNames,
  planRegistration,
  resetConfirmedTheEmail,
  resetMayResetNames,
  signupLinkStanding,
  signupProvenHere,
  unguessablePassword,
  type AccountByEmail,
  type PasswordProbe,
  type TokenLookup,
} from "@/lib/auth/signup-trust-core";
import { PLACEHOLDER_DISPLAY_NAME, isPlaceholderUsername } from "@/lib/auth/placeholder";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const between = (src: string, start: string, end: string) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));

const pendingId = "00000000-0000-3000-8000-000000000001";
const otherId = "00000000-0000-3000-8000-000000000002";
const WHEN = "2026-08-20T00:00:00Z";

const pending: AccountByEmail = { id: pendingId, emailConfirmedAt: null, invitedAt: null, lastSignInAt: null };
const confirmed: AccountByEmail = { ...pending, emailConfirmedAt: WHEN };
const invite: AccountByEmail = { ...pending, invitedAt: WHEN };

const free = { available: true } as const;
const heldBy = (userId: string) => ({ available: false, userId }) as const;

/** A password probe that records whether it was asked. */
function probe(answer: PasswordProbe) {
  const state = { asked: 0, opens: async () => ((state.asked += 1), answer) };
  return state;
}

test("an address is confirmed, a staff invite, or a pending self sign-up", () => {
  assert.equal(emailStanding(pending), "pending");
  assert.equal(emailStanding(confirmed), "confirmed");
  assert.equal(emailStanding(invite), "invite");
  // An invite that was accepted is confirmed, never "pending".
  assert.equal(emailStanding({ ...invite, emailConfirmedAt: WHEN, lastSignInAt: WHEN }), "confirmed");
});

test("a new address simply signs up, and nothing is probed", async () => {
  const password = probe("wrong");
  assert.deepEqual(await planRegistration({ existing: null, username: free, passwordOpens: password.opens }), { step: "sign-up" });
  assert.equal(password.asked, 0);
});

test("a confirmed address is left to the auth server and its password is never probed", async () => {
  const password = probe("opens");
  assert.deepEqual(await planRegistration({ existing: confirmed, username: free, passwordOpens: password.opens }), { step: "sign-up" });
  assert.equal(password.asked, 0, "a probe would sign in to a real account");
});

test("a staff invite is never replaced, signed up over, or probed", async () => {
  const password = probe("wrong");
  assert.deepEqual(await planRegistration({ existing: invite, username: free, passwordOpens: password.opens }), { step: "neutral" });
  assert.equal(password.asked, 0);
});

test("a pending account with someone else's password is replaced", async () => {
  const plan = await planRegistration({ existing: pending, username: free, passwordOpens: probe("wrong").opens });
  assert.deepEqual(plan, { step: "replace", userId: pendingId });
});

test("registering someone's address with their Minecraft name does not lock them out", async () => {
  // The name is "taken", but by the stale pending account for this same address.
  const plan = await planRegistration({ existing: pending, username: heldBy(pendingId), passwordOpens: probe("wrong").opens });
  assert.deepEqual(plan, { step: "replace", userId: pendingId });
});

test("the same person again resumes with the same name, or resends with another", async () => {
  const same = await planRegistration({ existing: pending, username: heldBy(pendingId), passwordOpens: probe("opens").opens });
  assert.deepEqual(same, { step: "resume", userId: pendingId });
  const renamed = await planRegistration({ existing: pending, username: free, passwordOpens: probe("opens").opens });
  assert.deepEqual(renamed, { step: "sign-up" });
});

test("a probe with no clear answer deletes nothing and creates nothing", async () => {
  // Rate limited or unreachable: the registrant's own pending account must survive a retry.
  for (const username of [free, heldBy(pendingId)]) {
    const password = probe("unknown");
    assert.deepEqual(await planRegistration({ existing: pending, username, passwordOpens: password.opens }), { step: "unfinished" });
    assert.equal(password.asked, 1);
  }
  // Still nothing to ask where the answer would not matter.
  for (const existing of [null, confirmed, invite]) {
    const password = probe("unknown");
    const plan = await planRegistration({ existing, username: free, passwordOpens: password.opens });
    assert.notEqual(plan.step, "unfinished");
    assert.equal(password.asked, 0);
  }
});

test("only the auth server's two definite answers count as an answer", () => {
  assert.equal(classifyPasswordProbe({ code: "email_not_confirmed", message: "Email not confirmed" }), "opens");
  assert.equal(classifyPasswordProbe({ code: "invalid_credentials", message: "Invalid login credentials" }), "wrong");
  // Older clients carry no code.
  assert.equal(classifyPasswordProbe({ message: "Email not confirmed" }), "opens");
  assert.equal(classifyPasswordProbe({ message: "Invalid login credentials" }), "wrong");
  // Everything else proves nothing: rate limits, server and network errors.
  for (const error of [
    { code: "over_request_rate_limit", message: "Request rate limit reached" },
    { code: "unexpected_failure", message: "Internal server error" },
    { code: "request_timeout", message: "Invalid login credentials" },
    { message: "fetch failed" },
    { message: "" },
    {},
  ]) {
    assert.equal(classifyPasswordProbe(error), "unknown", JSON.stringify(error));
  }
  // A sign-in that worked is not what a pending account does.
  assert.equal(classifyPasswordProbe(null), "unknown");
  assert.equal(classifyPasswordProbe(undefined), "unknown");
});

test("a name held by any other account is refused, whatever the address is", async () => {
  for (const existing of [null, pending, confirmed, invite]) {
    const password = probe("opens");
    const plan = await planRegistration({ existing, username: heldBy(otherId), passwordOpens: password.opens });
    assert.deepEqual(plan, { step: "refuse-username" });
    assert.equal(password.asked, 0, "refused before any password is tried");
  }
  // A confirmed account or an invite holding its own name is still a conflict:
  // neither is about to be replaced.
  assert.deepEqual(await planRegistration({ existing: confirmed, username: heldBy(pendingId), passwordOpens: probe("opens").opens }), { step: "refuse-username" });
  assert.deepEqual(await planRegistration({ existing: invite, username: heldBy(pendingId), passwordOpens: probe("opens").opens }), { step: "refuse-username" });
  // An owner that could not be named is nobody's own name.
  assert.deepEqual(await planRegistration({ existing: pending, username: heldBy(""), passwordOpens: probe("wrong").opens }), { step: "refuse-username" });
});

test("only a never-confirmed, never-used self sign-up for the same address may be deleted", () => {
  const user = {
    id: pendingId,
    email: "steve_42@example.com",
    created_at: WHEN,
    last_sign_in_at: null,
    invited_at: null,
    email_confirmed_at: null,
    confirmed_at: null,
  };
  assert.equal(mayReplacePending(user, "steve_42@example.com"), true);
  assert.equal(mayReplacePending(user, " Steve_42@Example.com "), true);
  // Created a moment ago counts: there is no minimum age here.
  assert.equal(mayReplacePending({ ...user, created_at: new Date().toISOString() }, "steve_42@example.com"), true);

  assert.equal(mayReplacePending({ ...user, email_confirmed_at: WHEN }, "steve_42@example.com"), false, "confirmed since the lookup");
  assert.equal(mayReplacePending({ ...user, confirmed_at: WHEN }, "steve_42@example.com"), false);
  assert.equal(mayReplacePending({ ...user, invited_at: WHEN }, "steve_42@example.com"), false, "a staff invite");
  assert.equal(mayReplacePending({ ...user, last_sign_in_at: WHEN }, "steve_42@example.com"), false, "has signed in");
  assert.equal(mayReplacePending(user, "alex_builder@example.com"), false, "another address");
  assert.equal(mayReplacePending({ ...user, email: null }, "steve_42@example.com"), false);
  assert.equal(mayReplacePending(user, ""), false);
  assert.equal(mayReplacePending({ ...user, created_at: null }, "steve_42@example.com"), false, "unreadable record");
});

test("a password is proven only by the marker for exactly the confirmed account", () => {
  assert.equal(signupProvenHere(pendingId, pendingId), true);
  // No marker: the owner confirming an account a stranger registered.
  assert.equal(signupProvenHere(undefined, pendingId), false);
  assert.equal(signupProvenHere("", pendingId), false);
  // An earlier registration from this browser, since replaced by someone else's.
  assert.equal(signupProvenHere(otherId, pendingId), false);
  // Exact, not "close": a prefix of the id is another value.
  assert.equal(signupProvenHere(pendingId.slice(0, -1), pendingId), false);
  // Nothing was verified.
  assert.equal(signupProvenHere(pendingId, undefined), false);
  assert.equal(signupProvenHere(undefined, undefined), false);
  assert.equal(signupProvenHere("", ""), false);
});

test("a reset that confirmed the email is told apart from one on a confirmed account", () => {
  const now = Date.parse("2026-08-30T12:00:00Z");
  const longAgo = "2026-08-01T12:00:00Z";
  const justNow = "2026-08-30T11:59:59Z";

  // The lookup before the code was spent is the answer when there is one,
  // whatever the clock says.
  assert.equal(resetConfirmedTheEmail({ confirmedBefore: false, emailConfirmedAt: longAgo, nowMs: now }), true);
  assert.equal(resetConfirmedTheEmail({ confirmedBefore: true, emailConfirmedAt: justNow, nowMs: now }), false);

  // The link: only the confirmation time is known.
  assert.equal(resetConfirmedTheEmail({ confirmedBefore: null, emailConfirmedAt: justNow, nowMs: now }), true);
  assert.equal(resetConfirmedTheEmail({ confirmedBefore: null, emailConfirmedAt: longAgo, nowMs: now }), false);
  // The auth server's clock may run ahead of or behind this one.
  const ahead = new Date(now + JUST_CONFIRMED_MARGIN_MS - 1000).toISOString();
  const behind = new Date(now - JUST_CONFIRMED_MARGIN_MS + 1000).toISOString();
  const tooOld = new Date(now - JUST_CONFIRMED_MARGIN_MS - 1000).toISOString();
  assert.equal(resetConfirmedTheEmail({ confirmedBefore: null, emailConfirmedAt: ahead, nowMs: now }), true);
  assert.equal(resetConfirmedTheEmail({ confirmedBefore: null, emailConfirmedAt: behind, nowMs: now }), true);
  assert.equal(resetConfirmedTheEmail({ confirmedBefore: null, emailConfirmedAt: tooOld, nowMs: now }), false);
  // Nothing readable: the safe side is to distrust the password.
  for (const value of [null, undefined, "", "not a date"]) {
    assert.equal(resetConfirmedTheEmail({ confirmedBefore: null, emailConfirmedAt: value, nowMs: now }), true, String(value));
  }
  assert.equal(JUST_CONFIRMED_MARGIN_MS, 5 * 60_000);
});

test("a sign-up verification on an old or invited account is not a first confirmation", () => {
  const now = Date.parse("2026-08-30T12:00:00Z");
  const longAgo = "2026-08-01T12:00:00Z";
  const justNow = "2026-08-30T11:59:59Z";
  const first = (input: { confirmedBefore: boolean | null; emailConfirmedAt?: string | null; invitedAt?: string | null }) =>
    firstSignupConfirmation({ emailConfirmedAt: justNow, invitedAt: null, ...input, nowMs: now });

  // An ordinary sign-up, with or without a lookup beforehand.
  assert.equal(first({ confirmedBefore: false }), true);
  assert.equal(first({ confirmedBefore: null }), true);
  // A reset token passed off as type=email on a long-standing account.
  assert.equal(first({ confirmedBefore: null, emailConfirmedAt: longAgo }), false);
  assert.equal(first({ confirmedBefore: true, emailConfirmedAt: longAgo }), false);
  // The lookup wins over the clock, both ways.
  assert.equal(first({ confirmedBefore: true }), false);
  assert.equal(first({ confirmedBefore: false, emailConfirmedAt: longAgo }), true);
  const edge = new Date(now - JUST_CONFIRMED_MARGIN_MS - 1000).toISOString();
  assert.equal(first({ confirmedBefore: null, emailConfirmedAt: edge }), false);
  // A staff invitation never is, whatever else is true of it.
  assert.equal(first({ confirmedBefore: false, invitedAt: WHEN }), false);
  assert.equal(first({ confirmedBefore: null, invitedAt: WHEN }), false);
  assert.equal(first({ confirmedBefore: null, invitedAt: WHEN, emailConfirmedAt: null }), false);
});

test("a sign-up link is spent only on one unconfirmed account that is not an invite", () => {
  const found = (account: { emailConfirmedAt: string | null; invitedAt: string | null }): TokenLookup => ({
    status: "found",
    account: { id: pendingId, ...account },
  });
  assert.equal(signupLinkStanding(found({ emailConfirmedAt: null, invitedAt: null })), "proceed");
  assert.equal(signupLinkStanding(found({ emailConfirmedAt: WHEN, invitedAt: null })), "refuse");
  assert.equal(signupLinkStanding(found({ emailConfirmedAt: null, invitedAt: WHEN })), "refuse");
  assert.equal(signupLinkStanding(found({ emailConfirmedAt: WHEN, invitedAt: WHEN })), "refuse");
  // A reset token is not in the confirmation column, so it finds nobody.
  assert.equal(signupLinkStanding({ status: "none" }), "unknown");
  assert.equal(signupLinkStanding({ status: "several" }), "refuse");
  // No database: left to the check after verifying, never refused on a guess.
  assert.equal(signupLinkStanding({ status: "unreadable" }), "unknown");
});

test("the lookup before a token is spent only speaks for the account that was verified", () => {
  const found = (emailConfirmedAt: string | null): TokenLookup => ({
    status: "found",
    account: { id: pendingId, emailConfirmedAt, invitedAt: null },
  });
  assert.equal(confirmedBeforeVerifying(found(WHEN), pendingId), true);
  assert.equal(confirmedBeforeVerifying(found(null), pendingId), false);
  assert.equal(confirmedBeforeVerifying(found(WHEN), otherId), null, "another account");
  assert.equal(confirmedBeforeVerifying(found(null), undefined), null);
  for (const status of ["none", "several", "unreadable"] as const) {
    assert.equal(confirmedBeforeVerifying({ status }, pendingId), null, status);
  }
  // The by-email lookup has the same shape.
  assert.equal(confirmedBeforeVerifying({ status: "found", account: confirmed }, pendingId), true);
  assert.equal(confirmedBeforeVerifying({ status: "found", account: pending }, pendingId), false);

  // Names go back to the placeholders only when the account was seen
  // unconfirmed beforehand, never on the clock alone.
  assert.equal(resetMayResetNames(false), true);
  assert.equal(resetMayResetNames(null), false);
  assert.equal(resetMayResetNames(true), false);
});

test("the neutral names are exactly the sign-up trigger's placeholders", () => {
  const names = neutralProfileNames("9D6A48D4-0000-3000-8000-000000000001");
  assert.equal(names.username, "player_9d6a48d4");
  assert.equal(names.displayName, PLACEHOLDER_DISPLAY_NAME);
  assert.equal(isPlaceholderUsername(names.username, "9d6a48d4-0000-3000-8000-000000000001"), true);
  assert.match(read("../../../supabase/migrations/031_derive_oauth_profile_names.sql"), /return 'player_' \|\| substr\(account_id::text, 1, 8\);/);
});

test("the fallback password is long, random and within bcrypt's limit", () => {
  const password = unguessablePassword();
  assert.notEqual(password, unguessablePassword());
  assert.ok(password.length >= 64 && Buffer.byteLength(password) <= 72);
  for (const kind of [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/]) assert.match(password, kind);
});

test("clearing the session by hand covers the cookies sent and the ones just written", () => {
  const names = authCookieNames("https://exampleref.supabase.co", [
    "sb-exampleref-auth-token.0",
    "sb-exampleref-auth-token.1",
    "sb-otherref-auth-token",
    "mz_pending_signup",
    "mz_session_only",
  ]);
  assert.ok(names.includes("sb-exampleref-auth-token"));
  assert.ok(names.includes("sb-exampleref-auth-token.0"));
  assert.ok(names.includes("sb-exampleref-auth-token.4"));
  assert.ok(names.includes("sb-otherref-auth-token"));
  assert.ok(!names.some((name) => name.startsWith("mz_")), "the app's own cookies are left alone");
  assert.equal(new Set(names).size, names.length);
  // No usable URL: only what the browser sent.
  assert.deepEqual(authCookieNames(undefined, ["sb-exampleref-auth-token", "theme"]), ["sb-exampleref-auth-token"]);
  assert.deepEqual(authCookieNames("not a url", []), []);
});

test("the messages name the way forward and nobody's account", () => {
  assert.match(SIGNUP_LINK_ELSEWHERE, /browser you registered in/);
  assert.match(SIGNUP_LINK_ELSEWHERE, /6-digit code/);
  assert.match(UNPROVEN_SIGNUP_MESSAGE, /^Your email is confirmed\./);
  for (const message of [UNPROVEN_SIGNUP_MESSAGE, UNPROVEN_SIGNUP_UNSECURED]) assert.match(message, /Forgot password/);
  for (const message of [SIGNUP_LINK_ELSEWHERE, UNPROVEN_SIGNUP_MESSAGE, UNPROVEN_SIGNUP_UNSECURED]) {
    assert.doesNotMatch(message, /\$\{|someone|another (person|user)|registered more than once/i);
  }
});

// ---- Wiring: source assertions only from here on. ----

test("the flag-and-nonce mechanism is gone", () => {
  for (const file of ["../auth/contested-signup.ts", "../auth/contested-signup-core.ts", "./contested-signup.test.ts"]) {
    assert.equal(existsSync(new URL(file, import.meta.url)), false, file);
  }
  for (const file of ["../actions/auth.ts", "../auth/signup-trust.ts", "../auth/signup-trust-core.ts", "../auth/reauth.ts"]) {
    assert.doesNotMatch(read(file), /signup_contested|signup_nonce_hash|mz_signup_claim|isSignupContested|withoutSignupFlags/, file);
  }
});

test("registration looks the address up first and replaces a stale pending account before signing up", () => {
  const auth = read("../actions/auth.ts");
  const register = between(auth, "export async function registerAction", "export async function oauthAction");
  const lookup = register.indexOf("const lookup = await findAccountByEmail(parsed.data.email);");
  const plan = register.indexOf("const plan = await planRegistration({");
  const replace = register.indexOf("await replacePendingSignup(admin, plan.userId, parsed.data.email)");
  const signUp = register.indexOf("supabase.auth.signUp(");
  assert.ok(lookup > 0 && lookup < plan && plan < replace && replace < signUp, "so only one confirmation email is sent");
  assert.equal((register.match(/supabase\.auth\.signUp\(/g) ?? []).length, 1);

  // Fail closed: no answer, or a delete that did not happen, creates nothing.
  assert.match(register.slice(lookup, plan), /if \(lookup\.status === "unreadable"\) return \{ ok: false, message: REGISTRATION_UNFINISHED \};/);
  assert.match(
    register.slice(replace - 40, signUp),
    /if \(!admin \|\| !\(await replacePendingSignup\(admin, plan\.userId, parsed\.data\.email\)\)\) \{\s*return \{ ok: false, message: REGISTRATION_UNFINISHED \};/,
  );
  // The name is checked again once the stale account's own claim is gone.
  assert.match(register.slice(replace, signUp), /if \(!\(await ignAvailability\(admin, parsed\.data\.username\)\)\.available\) \{/);
  // The probe is the pending-password check, handed to the plan to call or not.
  assert.match(register, /passwordOpens: \(\) => pendingRegistrationCredentialsMatch\(parsed\.data\.email, parsed\.data\.password\),/);

  // A staff invite and a resumed registration both return before the sign-up.
  const neutral = register.indexOf('if (plan.step === "neutral") {');
  const resume = register.indexOf('if (plan.step === "resume") {');
  assert.ok(neutral > plan && neutral < signUp && resume > plan && resume < signUp);
  assert.match(register.slice(resume, signUp), /await markPendingSignup\(plan\.userId\);/);

  // After the sign-up, the browser is marked only if the typed password opens the account.
  // Only "opens" counts: a probe with no clear answer is not proof either.
  const check = register.indexOf('(await pendingRegistrationCredentialsMatch(parsed.data.email, parsed.data.password)) !== "opens"', signUp);
  const mark = register.indexOf("if (data.user) await markPendingSignup(data.user.id);");
  assert.ok(check > signUp && check < mark);
  assert.match(register.slice(check, mark), /return \{ ok: false, message: REGISTRATION_UNFINISHED \};/);
  assert.doesNotMatch(register.slice(check, mark), /deleteUser|replacePendingSignup/, "nothing is deleted on it");

  // An inconclusive probe before the sign-up stops there, ahead of any delete.
  const unfinished = register.indexOf('if (plan.step === "unfinished") return { ok: false, message: REGISTRATION_UNFINISHED };');
  assert.ok(unfinished > plan && unfinished < replace);
  const probeSrc = between(auth, "async function pendingRegistrationCredentialsMatch", "\n}\n");
  assert.match(probeSrc, /Promise<PasswordProbe>/);
  assert.match(probeSrc, /if \(!config\) return "unknown";/);
  assert.match(probeSrc, /const answer = classifyPasswordProbe\(error\);/);
  assert.match(probeSrc, /\} catch \{[\s\S]*?return "unknown";/);

  // A sign-up that cannot be completed never deletes an account unguarded:
  // the auth server may have answered with one that already existed.
  assert.doesNotMatch(register, /admin\.auth\.admin\.deleteUser\(/);
  const profile = register.indexOf("if (data.user && admin && !(await ensureUserProfile(data.user))) {");
  assert.ok(profile > signUp);
  assert.match(register.slice(profile, check), /await replacePendingSignup\(admin, data\.user\.id, parsed\.data\.email\);\s*return \{ ok: false,/);
  // No second cookie, and the marker is set for a confirmed address and an invite too.
  assert.equal((auth.match(/const [A-Z_]+_COOKIE = /g) ?? []).length, 1);
  assert.equal((register.match(/await markPendingSignup\(randomUUID\(\)\);\s*return \{ ok: true \};/g) ?? []).length, 2);
});

test("the deletion is the cleanup's own, after reading the account again", () => {
  const src = read("../auth/signup-trust.ts");
  const replace = between(src, "export async function replacePendingSignup", "\n}\n");
  const reread = replace.indexOf("await admin.auth.admin.getUserById(userId)");
  const allowed = replace.indexOf("if (!mayReplacePending(data.user, email)) {");
  const remove = replace.indexOf("await admin.auth.admin.deleteUser(userId)");
  assert.ok(reread > 0 && reread < allowed && allowed < remove);
  assert.match(replace.slice(allowed, remove), /return false;/);
  assert.match(replace.slice(remove), /if \(deleteError\) \{[\s\S]*?return false;/);
  assert.match(read("../data/cleanup-unconfirmed.ts"), /await admin\.auth\.admin\.deleteUser\(user\.id\)/);

  // With a database the check and the delete are one statement, so an account
  // confirmed in between cannot be deleted. Its conditions are mayReplacePending's.
  const direct = replace.indexOf("delete from auth.users");
  assert.ok(direct > 0 && direct < reread, "the admin API is only the fallback");
  const statement = replace.slice(direct, replace.indexOf("returning id", direct));
  for (const condition of [
    "where id = ${userId}::uuid",
    "and lower(btrim(email)) = ${wanted}",
    "and email_confirmed_at is null",
    "and confirmed_at is null",
    "and invited_at is null",
    "and last_sign_in_at is null",
    "and created_at is not null",
  ]) {
    assert.ok(statement.includes(condition), condition);
  }
  // No row deleted is "not replaced", and does not go on to the admin API.
  assert.match(replace.slice(direct, reread), /if \(rows\.length === 1\) return true;[\s\S]*?return false;\s*\} catch/);
  assert.match(replace.slice(0, direct), /const wanted = email\.trim\(\)\.toLowerCase\(\);\s*if \(!wanted\) return false;/);
  // The database does the dependent clean-up itself, whoever deletes the row.
  const fks = read("../../../supabase/migrations/032_restore_auth_user_foreign_keys.sql");
  assert.match(fks, /create trigger prepare_public_data_before_auth_user_delete\s+before delete on auth\.users/);
  for (const constraint of ["profiles_user_id_fkey", "minecraft_accounts_user_id_fkey"]) {
    assert.match(fks, new RegExp(`add constraint ${constraint}\\s+foreign key \\(user_id\\) references auth\\.users\\(id\\) on delete cascade;`));
  }
  assert.doesNotMatch(src, /^["']use server["'];?\s*$/m, "not a server-action file");
  // A failed lookup is its own answer, never "no account".
  const find = between(src, "export async function findAccountByEmail", "\n}\n");
  assert.ok((find.match(/return \{ status: "unreadable" \};/g) ?? []).length >= 4);
  assert.match(find, /from auth\.users\s+where email = \$\{wanted\}/);
});

test("a sign-up link is refused, unspent, where nothing was registered", () => {
  const auth = read("../actions/auth.ts");
  const confirm = between(auth, "export async function confirmEmailAction", "export async function confirmEmailCodeAction");
  const verify = confirm.indexOf("supabase.auth.verifyOtp(");
  const absent = confirm.indexOf("if (signupLink && !(await cookies()).get(PENDING_SIGNUP_COOKIE)?.value) {");
  assert.ok(absent > 0 && absent < verify, "before the token is spent");
  assert.match(confirm.slice(absent, verify), /return \{ ok: false, message: SIGNUP_LINK_ELSEWHERE \};/);
  assert.match(confirm, /const signupLink = type === "signup" \|\| type === "email";/);
});

test("both confirmation paths apply the one rule straight after verifying", () => {
  const auth = read("../actions/auth.ts");
  const link = between(auth, "export async function confirmEmailAction", "export async function confirmEmailCodeAction");
  const code = between(auth, "export async function confirmEmailCodeAction", "export async function resendConfirmationAction");
  for (const [name, body] of [["link", link], ["code", code]] as const) {
    const verify = body.indexOf("supabase.auth.verifyOtp(");
    const settle = body.indexOf("const unproven = await settleSignupConfirmation(supabase, verified.user);");
    assert.ok(verify > 0 && settle > verify, name);
    assert.match(body.slice(settle), /^const unproven = await settleSignupConfirmation\(supabase, verified\.user\);\s*if \(unproven\) return unproven;/, name);
    assert.ok(settle < body.lastIndexOf("redirect("), `${name}: before the signed-in redirect`);
  }

  const settle = between(auth, "async function settleSignupConfirmation", "\n}\n");
  assert.match(settle, /const registeredHere = signupProvenHere\(store\.get\(PENDING_SIGNUP_COOKIE\)\?\.value, user\?\.id\);\s*store\.delete\(PENDING_SIGNUP_COOKIE\);/);
  // Proven: the Minecraft name is linked and the session stays.
  assert.match(settle, /if \(registeredHere\) \{\s*await linkVerifiedRegistration\(user, true\);\s*return null;\s*\}/);
  // Unproven: password, then names, then the session, in that order.
  const remove = settle.indexOf('const removal = user ? await removeAccountPassword(user.id) : "failed";');
  const names = settle.indexOf("if (user) await resetUnprovenNames(user.id);");
  const out = settle.indexOf("await endLocalSession(supabase);");
  const failed = settle.indexOf('if (removal === "failed") {');
  const done = settle.indexOf("return { ok: true, message: UNPROVEN_SIGNUP_MESSAGE };");
  assert.ok(remove > 0 && remove < names && names < out && out < failed && failed < done);
  // Fail closed: signed out first, and an error rather than a success.
  assert.match(settle.slice(failed, done), /return \{ ok: false, message: UNPROVEN_SIGNUP_UNSECURED \};/);
  // No stranger's Minecraft name is linked.
  assert.match(settle.slice(failed, done), /await linkVerifiedRegistration\(user, false\);/);
  assert.equal((settle.match(/linkVerifiedRegistration\(user, true\)/g) ?? []).length, 1);
});

test("a sign-up verification that did not just confirm the account changes nothing on it", () => {
  const auth = read("../actions/auth.ts");
  const link = between(auth, "export async function confirmEmailAction", "export async function confirmEmailCodeAction");
  const code = between(auth, "export async function confirmEmailCodeAction", "export async function resendConfirmationAction");

  // Both paths ask before settling, so a marker for this very account cannot
  // turn an old account's verification into a session either.
  for (const [name, body] of [["link", link], ["code", code]] as const) {
    const verify = body.indexOf("supabase.auth.verifyOtp(");
    const guard = body.indexOf("if (await notAFirstSignupConfirmation(supabase, verified.user, ");
    const settle = body.indexOf("await settleSignupConfirmation(supabase, verified.user);");
    assert.ok(verify > 0 && guard > verify && guard < settle, name);
    assert.equal((body.match(/settleSignupConfirmation\(/g) ?? []).length, 1, name);
  }
  assert.match(link, /if \(await notAFirstSignupConfirmation\(supabase, verified\.user, confirmedBefore\)\) \{\s*return \{ ok: false, message: LINK_INVALID \};/);
  assert.match(auth, /const LINK_INVALID = "This link is invalid or has expired\. Request a new one from the login page\.";/);

  // The refusal ends the session and touches neither the password nor the names.
  const guard = between(auth, "async function notAFirstSignupConfirmation", "\n}\n");
  assert.match(guard, /const first = firstSignupConfirmation\(\{\s*confirmedBefore,\s*emailConfirmedAt: user\?\.email_confirmed_at,\s*invitedAt: user\?\.invited_at,\s*nowMs: Date\.now\(\),\s*\}\);/);
  assert.match(guard, /if \(first\) return false;[\s\S]*await endLocalSession\(supabase\);\s*return true;/);
  assert.doesNotMatch(guard, /removeAccountPassword|resetUnprovenNames|issueResetGrant|linkVerifiedRegistration|store\.delete/);

  // The link is also checked before it is spent, where a database can answer.
  const verify = link.indexOf("supabase.auth.verifyOtp(");
  const before = link.indexOf("const signupBefore = signupLink ? await findAccountByConfirmationToken(tokenHash) : null;");
  assert.ok(before > 0 && before < verify);
  assert.match(link.slice(before, verify), /if \(signupBefore && signupLinkStanding\(signupBefore\) === "refuse"\) \{\s*return \{ ok: false, message: LINK_INVALID \};/);
  const byToken = between(read("../auth/signup-trust.ts"), "export async function findAccountByConfirmationToken", "\n}\n");
  assert.match(byToken, /if \(!tokenHash\) return \{ status: "none" \};\s*const db = getDb\(\);\s*if \(!db\) return \{ status: "unreadable" \};/);
  assert.match(byToken, /from auth\.users\s+where confirmation_token = \$\{tokenHash\}\s+limit 2/);
  assert.match(byToken, /\} catch \(error\) \{[\s\S]*?return \{ status: "unreadable" \};/);

  // The code: an address that is not a pending self sign-up is answered like
  // a wrong code, before anything is spent.
  const codeBefore = code.indexOf("const before = await findAccountByEmail(parsed.data.email);");
  const codeVerify = code.indexOf("supabase.auth.verifyOtp(");
  assert.ok(codeBefore > 0 && codeBefore < codeVerify);
  assert.match(code.slice(codeBefore, codeVerify), /if \(before\.status === "found" && emailStanding\(before\.account\) !== "pending"\) \{\s*return \{ ok: false, errors: \{ token: /);

  // "email" stays an accepted type, with the reason it needs this written down.
  const validation = read("../validation/auth.ts");
  assert.match(validation, /export const otpTypes = \["signup", "email", "recovery"\] as const;/);
  assert.match(validation.slice(0, validation.indexOf("export const otpTypes")), /also accepts a password-reset token/);
});

test("a password that could not be recorded or removed is logged, without the address", () => {
  const mark = between(read("../actions/auth.ts"), "async function markHasPassword", "\n}\n");
  assert.match(mark, /const recorded = await recordPasswordSet\(userId\);\s*if \(!recorded\) console\.error\("[^"$]+"\);/);
  const remove = between(read("../auth/signup-trust.ts"), "export async function removeAccountPassword", "\n}\n");
  assert.match(remove, /console\.error\("[^"$]+"\);\s*return "failed";/);
});

test("the password is blanked in the database, with the admin API only as a fallback", () => {
  const src = read("../auth/signup-trust.ts");
  const remove = between(src, "export async function removeAccountPassword", "\n}\n");
  assert.match(remove, /update auth\.users\s+set encrypted_password = null,/);
  assert.match(remove, /'\{"has_password": false\}'::jsonb/);
  assert.match(remove, /where id = \$\{userId\}::uuid\s+returning id/);
  const direct = remove.indexOf('if (rows.length === 1) return "removed";');
  const fallback = remove.indexOf("admin.auth.admin.updateUserById(userId, { password: unguessablePassword() })");
  assert.ok(direct > 0 && direct < fallback);
  assert.match(remove.slice(fallback), /if \(!error\) return "replaced";[\s\S]*return "failed";/);

  // "No password" is honoured where the password is asked about...
  const reauth = between(read("../auth/reauth.ts"), "export function accountHasPassword", "\n}\n");
  const explicitNo = reauth.indexOf("if (user.app_metadata?.has_password === false) return false;");
  assert.ok(explicitNo > 0 && explicitNo < reauth.indexOf('identity?.provider === "email"'), "before the email identity says yes");
  assert.match(read("../../components/account/account-panels.tsx"), /data\.user\.app_metadata\?\.has_password !== false &&/);
  // ...and choosing a password turns it back, by a second route if the first fails.
  const auth = read("../actions/auth.ts");
  const mark = between(auth, "async function markHasPassword", "\n}\n");
  assert.match(mark, /app_metadata: \{ \.\.\.\(data\?\.user\?\.app_metadata \?\? \{\}\), has_password: true \},/);
  assert.match(mark, /if \(!error\) return;[\s\S]*await recordPasswordSet\(userId\);/);
});

test("a reset that confirms the email removes the old password before the reset grant", () => {
  const auth = read("../actions/auth.ts");
  const code = between(auth, "export async function verifyResetCodeAction", "\n}\n");
  const before = code.indexOf("const before = await findAccountByEmail(parsed.data.email);");
  const verify = code.indexOf("supabase.auth.verifyOtp(");
  const distrust = code.indexOf("await distrustPasswordAfterFirstConfirmation(supabase, verified.user, confirmedBefore);");
  const grant = code.indexOf("issueResetGrant(");
  assert.ok(before > 0 && before < verify && verify < distrust && distrust < grant, "looked up before the code is spent");
  assert.match(code, /before\.status === "found" && before\.account\.id === verified\.user\?\.id\s*\? emailStanding\(before\.account\) === "confirmed"\s*: null;/);
  assert.match(code.slice(distrust, grant), /if \(stopped\) return stopped;/);

  const link = between(auth, "export async function confirmEmailAction", "export async function confirmEmailCodeAction");
  const bound = link.indexOf("if (!(await resetRequestedHereFor(verified.user?.email)))");
  const linkDistrust = link.indexOf("await distrustPasswordAfterFirstConfirmation(supabase, verified.user, confirmedBefore);");
  const linkGrant = link.indexOf("issueResetGrant(");
  assert.ok(bound > 0 && bound < linkDistrust && linkDistrust < linkGrant, "only for the browser that asked, and before the grant");
  // The link's account is looked up by its token before the token is spent,
  // so an account confirmed minutes ago is not taken for one this link confirmed.
  const linkBefore = link.indexOf('const recoveryBefore = type === "recovery" ? await findAccountByRecoveryToken(tokenHash) : null;');
  assert.ok(linkBefore > 0 && linkBefore < link.indexOf("supabase.auth.verifyOtp("));
  assert.match(
    link.slice(bound, linkDistrust),
    /const confirmedBefore = recoveryBefore \? confirmedBeforeVerifying\(recoveryBefore, verified\.user\?\.id\) : null;/,
  );
  assert.doesNotMatch(link, /distrustPasswordAfterFirstConfirmation\(supabase, verified\.user, null\)/);
  const byToken = between(read("../auth/signup-trust.ts"), "export async function findAccountByRecoveryToken", "\n}\n");
  assert.match(byToken, /if \(!tokenHash\) return \{ status: "none" \};\s*const db = getDb\(\);\s*if \(!db\) return \{ status: "unreadable" \};/);
  assert.match(byToken, /from auth\.users\s+where recovery_token = \$\{tokenHash\}\s+limit 2/);
  assert.match(byToken, /\} catch \(error\) \{[\s\S]*?return \{ status: "unreadable" \};/);

  const helper = between(auth, "async function distrustPasswordAfterFirstConfirmation", "\n}\n");
  assert.match(helper, /if \(!firstConfirmation\) return null;/);
  // Names are reset only for an account seen unconfirmed beforehand.
  assert.match(helper, /else if \(resetMayResetNames\(confirmedBefore\)\) await resetUnprovenNames\(user\.id\);/);
  assert.equal((helper.match(/resetUnprovenNames\(/g) ?? []).length, 1);
  // The recovery session survives only a direct removal; anything else stops the reset, signed out.
  assert.match(helper, /if \(user && removal === "removed"\) \{[\s\S]*?return null;\s*\}/);
  const stop = helper.lastIndexOf("await endLocalSession(supabase);");
  assert.ok(stop > helper.indexOf('removal === "removed"'));
  assert.match(helper.slice(stop), /return \{ ok: false, message: /);

  // The "different from your current password" check copes with no password.
  const finish = between(auth, "export async function finishPasswordResetAction", "\n}\n");
  assert.match(finish, /if \(accountHasPassword\(userData\.user\) && \(await passwordMatchesCurrent\(email, parsed\.data\.password\)\)\) \{/);
});

test("no refusal in the auth actions ignores a failed sign-out", () => {
  const auth = read("../actions/auth.ts");
  assert.doesNotMatch(auth, /signOut\(\{ scope: "local" \}\)/, "every local sign-out goes through endLocalSession");
  const helper = between(read("../auth/signup-trust.ts"), "export async function endLocalSession", "\n}\n");
  assert.match(helper, /const \{ error \} = await supabase\.auth\.signOut\(\{ scope: "local" \}\);\s*if \(!error\) return;/);
  assert.match(helper, /for \(const name of authCookieNames\(getSupabaseConfig\(\)\?\.url, present\)\) store\.delete\(name\);/);
});

test("logging in to a pending account marks the browser only once the password matched", () => {
  const auth = read("../actions/auth.ts");
  const login = between(auth, "export async function loginAction", "\n}\n");
  const unconfirmed = login.indexOf("if (isUnconfirmedEmailError(error)) {");
  const mark = login.indexOf("await markPendingSignup(pending.account.id);");
  assert.ok(unconfirmed > 0 && mark > unconfirmed && mark < login.indexOf("return { ok: false, message: SIGN_IN_FAILED };"));
  assert.match(login.slice(unconfirmed, mark), /if \(pending\.status === "found" && emailStanding\(pending\.account\) === "pending"\) \{/);
});

test("both forms show the unproven result as a finished step that leads to Forgot password", () => {
  const forms = read("../../components/auth/auth-forms.tsx");
  const codeForm = between(forms, "export function VerifyEmailCodeForm", "function RequestResetCodeForm");
  const done = codeForm.indexOf("if (state.ok && state.message) return <UnprovenConfirmation message={state.message} />;");
  assert.ok(done > 0 && done < codeForm.indexOf('<OtpInput id="confirm-token"'), "returns before the code boxes and the resend row render");
  // The code boxes still submit themselves once the sixth digit is in.
  assert.match(codeForm, /<OtpInput id="confirm-token" name="token" error=\{tokenError\} autoSubmit \/>/);

  const linkForm = forms.slice(forms.indexOf("export function ConfirmEmailForm"));
  assert.match(linkForm, /if \(state\.ok && state\.message\) return <UnprovenConfirmation message=\{state\.message\} \/>;/);
  // A refusal (the link opened elsewhere) shows above the button, which still works later.
  assert.match(linkForm, /<AuthMessage message=\{state\.message\} \/>/);

  const shared = between(forms, "function UnprovenConfirmation", "\n}\n");
  assert.match(shared, /className="auth-success-state"/);
  assert.match(shared, /<p>\{message\}<\/p>/);
  assert.match(shared, /<AuthFlowLink view="forgot-password" href="\/forgot-password" className="btn btn-primary auth-submit">/);
  assert.match(shared, /<AuthFlowLink view="login" href="\/login">Log in<\/AuthFlowLink>/);
  assert.doesNotMatch(shared, /OtpInput|resendAction|next\/link/);
});
