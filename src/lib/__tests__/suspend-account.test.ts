import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const between = (src: string, start: string, end: string) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));

test("suspending checks permission, self and rank before anything changes", () => {
  const src = read("../actions/user-admin.ts");
  const action = between(src, "export async function setUserSuspendedAction", "\n}\n");
  const change = action.indexOf("await setAccountSuspended(userId, suspend)");
  assert.ok(change > 0);
  for (const guard of [
    "await canAssignRoles(session, actorId)",
    "if (userId === actorId)",
    "if (!canManageRank(session.role, targetRole))",
  ]) {
    const at = action.indexOf(guard);
    assert.ok(at > 0 && at < change, guard);
  }
  // Suspending also signs them out everywhere, and both directions are audited.
  assert.match(action, /if \(suspend && !\(await endAllSessions\(userId\)\)\)/);
  assert.match(action, /action: suspend \? "user\.suspend" : "user\.unsuspend"/);
});

test("the status only moves active ⇄ suspended, never from pending or deleted", () => {
  const src = read("../data/account-status.ts");
  assert.match(src, /const from = suspended \? "active" : "suspended";/);
  assert.match(src, /eq\(schema\.profiles\.accountStatus, from\)/);
  assert.match(src, /delete from auth\.sessions where user_id = \$\{userId\}::uuid/);
});

test("a suspended account is refused at sign-in, only after the password matched", () => {
  const auth = read("../actions/auth.ts");
  const login = between(auth, "export async function loginAction", "\n}\n");
  const failed = login.indexOf("return { ok: false, message: SIGN_IN_FAILED };");
  // The status is read once and both checks branch on that one answer.
  assert.equal((login.match(/accountStatusFor\(/g) ?? []).length, 1);
  const statusRead = login.indexOf("const status = signedIn.user ? await accountStatusFor(signedIn.user.id) : null;");
  const suspended = login.indexOf('if (status === "suspended" && !hasAuthenticator) {');
  assert.ok(failed > 0 && statusRead > failed && suspended > statusRead, "checked after a wrong password has already been turned away");
  assert.ok(login.indexOf("await endLocalSession(supabase);", suspended) > suspended);
  assert.ok(login.indexOf("redirect(SUSPENDED_PATH)", suspended) > suspended);

  const callback = read("../../app/auth/callback/route.ts");
  assert.match(callback, /profile\?\.account_status === "suspended"/);
  assert.match(callback, /NextResponse\.redirect\(new URL\(SUSPENDED_PATH, origin\)\)/);
  assert.match(read("../auth/login-identifier.ts"), /export const SUSPENDED_PATH = "\/account-suspended";/);
});

test("getSession still refuses any profile that is not active", () => {
  assert.match(read("../auth/index.ts"), /profile\.account_status !== "active"/);
});

test("a suspended account is refused by getSessionUserId too, not just getSession", () => {
  // A token minted straight from Supabase must not reach orders, likes or notifications.
  const src = read("../auth/index.ts");
  const authUser = src.slice(src.indexOf("const getAuthUser = cache("), src.indexOf("export async function isTwoFactorPending"));
  assert.match(authUser, /const status = await accountStatusFor\(state\.user\.id\);/);
  assert.match(authUser, /if \(status === "suspended" \|\| status === "deleted"\) return null;/);
});

test("a status that cannot be read is refused, not waved through", () => {
  const status = read("../data/account-status.ts");
  const reader = between(status, "export const accountStatusFor = cache(", "\n});\n");
  // A failed read is its own answer, never the null that means "no profile yet".
  assert.match(status, /export const STATUS_UNREADABLE = "unreadable" as const;/);
  assert.match(reader, /if \(!admin\) return STATUS_UNREADABLE;/);
  assert.ok((reader.match(/return STATUS_UNREADABLE;/g) ?? []).length >= 3, "no client, a query error and a thrown error");
  // The database error no longer returns: it falls through to the second source.
  const caught = reader.slice(reader.indexOf('console.error("Account status read failed", error);'));
  assert.doesNotMatch(caught.slice(0, caught.indexOf("getSupabaseAdmin()")), /return/);
  // A missing row is still null on both sources.
  assert.match(reader, /return \(row\?\.status as AccountStatus \| undefined\) \?\? null;/);
  assert.match(reader, /return \(data\?\.account_status as AccountStatus \| undefined\) \?\? null;/);

  // getSessionUserId and getDiscordIdentity both go through getAuthUser.
  const index = read("../auth/index.ts");
  const authUser = index.slice(index.indexOf("const getAuthUser = cache("), index.indexOf("export async function isTwoFactorPending"));
  const refused = authUser.indexOf("if (status === STATUS_UNREADABLE) return null;");
  assert.ok(refused > 0 && refused < authUser.indexOf("return state.user;"));
  assert.match(index, /return \(await getAuthUser\(\)\)\?\.id \?\? null;/);
  assert.match(between(index, "export async function getDiscordIdentity", "\n}\n"), /const user = await getAuthUser\(\);\s*if \(!user\) return null;/);

  // Sign-in and the last step of a reset refuse it as well.
  const auth = read("../actions/auth.ts");
  const login = between(auth, "export async function loginAction", "\n}\n");
  const unreadable = login.indexOf("if (status === STATUS_UNREADABLE) {");
  assert.ok(unreadable > login.indexOf("await accountStatusFor(signedIn.user.id)"), "on the status that was just read");
  assert.ok(unreadable > 0 && unreadable < login.indexOf("dispatchSignInNotifications("), "before the sign-in is treated as complete");
  assert.ok(login.indexOf("await endLocalSession(supabase);", unreadable) > unreadable);
  const reset = between(auth, "export async function finishPasswordResetAction", "\n}\n");
  assert.equal((reset.match(/accountStatusFor\(/g) ?? []).length, 1, "read once");
  const resetUnreadable = reset.indexOf("if (status === STATUS_UNREADABLE) {");
  assert.ok(resetUnreadable > reset.indexOf("const status = await accountStatusFor(userData.user.id);"));
  assert.ok(resetUnreadable > 0 && resetUnreadable < reset.indexOf("supabase.auth.updateUser("));
});

test("a provider sign-in with an unreadable status is ended, not treated as not suspended", () => {
  const callback = read("../../app/auth/callback/route.ts");
  assert.match(callback, /import \{ STATUS_UNREADABLE, accountStatusFor \} from "@\/lib\/data\/account-status";/);
  const check = callback.indexOf("if ((await accountStatusFor(data.user.id)) === STATUS_UNREADABLE) {");
  assert.ok(check > callback.indexOf("await ensureUserProfile(data.user)"), "after the profile row has been ensured");
  // Before the suspension check (which a null profile passes) and before the sign-in counts.
  assert.ok(check < callback.indexOf('profile?.account_status === "suspended"'));
  assert.ok(check < callback.indexOf("dispatchSignInNotifications("));
  assert.match(
    callback.slice(check),
    /^if \(\(await accountStatusFor\(data\.user\.id\)\) === STATUS_UNREADABLE\) \{\s*await supabase\.auth\.signOut\(\{ scope: "local" \}\);/,
  );
  const refusal = callback.slice(check, callback.indexOf("// Suspended", check));
  assert.match(refusal, /new URL\("\/login", origin\)/);
  assert.match(refusal, /searchParams\.set\("error", "auth_unavailable"\)/);
  assert.match(refusal, /return NextResponse\.redirect\(unavailable\);/);
  // The login panel has words for that code, the same ones loginAction uses.
  const message = "Authentication is temporarily unavailable. Please try again.";
  assert.ok(read("../../components/auth/auth-panels.tsx").includes(`auth_unavailable: "${message}"`));
  assert.ok(between(read("../actions/auth.ts"), "export async function loginAction", "\n}\n").includes(message));
});

test("the Users board locks your own row by account id", () => {
  assert.match(read("../../app/admin/users/page.tsx"), /account\.userId === actorId\) lockedReason = "Your account"/);
});

test("with two-step on, a suspended account learns it only after the code too", () => {
  const auth = read("../actions/auth.ts");
  assert.match(auth, /if \(status === "suspended" && !hasAuthenticator\) \{/);
  assert.match(read("../../app/auth/callback/route.ts"), /profile\?\.account_status === "suspended" && !hasFactor/);
  const twoFactor = read("../actions/two-factor.ts");
  for (const name of ["verifyTwoFactorAction", "redeemRecoveryCodeAction"]) {
    const start = twoFactor.indexOf(`export async function ${name}`);
    const body = twoFactor.slice(start, twoFactor.indexOf("\n}\n", start));
    assert.match(body, /await refuseIfSuspended\(pending\);/, name);
  }
});

test("the second step refuses an account whose status could not be read", () => {
  const twoFactor = read("../actions/two-factor.ts");
  assert.match(twoFactor, /import \{ STATUS_UNREADABLE, accountStatusFor \} from "@\/lib\/data\/account-status";/);
  const refuse = between(twoFactor, "async function refuseIfSuspended(", "\n}\n");
  // Only a status that was read, and is not "suspended", lets the sign-in finish.
  assert.match(refuse, /const status = await accountStatusFor\(pending\.user\.id\);\s*if \(status !== "suspended" && status !== STATUS_UNREADABLE\) return;/);
  // Both refusals end the session the same way, before the redirect.
  const signOut = refuse.indexOf('await pending.supabase.auth.signOut({ scope: "local" });');
  const leave = refuse.indexOf('redirect(status === "suspended" ? SUSPENDED_PATH : "/login?error=auth_unavailable");');
  assert.ok(signOut > 0 && leave > signOut);
  // The login panel turns that code into the words loginAction uses.
  assert.ok(
    read("../../components/auth/auth-panels.tsx").includes('auth_unavailable: "Authentication is temporarily unavailable. Please try again."'),
  );
});

test("a suspended account cannot finish a password reset", () => {
  const auth = read("../actions/auth.ts");
  const reset = between(auth, "export async function finishPasswordResetAction", "\n}\n");
  const check = reset.indexOf('if (status === "suspended") {');
  assert.ok(check > reset.indexOf("const status = await accountStatusFor(userData.user.id);"));
  assert.ok(check > 0 && check < reset.indexOf("supabase.auth.updateUser("), "refused before the password changes");
});

test("releasing someone's IGN follows the rank ladder", () => {
  const src = read("../actions/user-admin.ts");
  const release = src.slice(src.indexOf("export async function adminReleaseMinecraftUsernameAction"));
  const guard = release.indexOf("if (!canManageRank(session.role, targetRole))");
  assert.ok(guard > 0 && guard < release.indexOf('.from("minecraft_accounts").delete()'));
});

test("074 closes every RLS table to a suspended account's own token", () => {
  const sql = read("../../../supabase/migrations/074_suspended_account_gate.sql");
  assert.ok(sql.includes("create or replace function public.account_usable()"));
  assert.ok(sql.includes("p.account_status in ('suspended', 'deleted')"));
  assert.ok(sql.includes("as restrictive for all to authenticated"));
  assert.ok(sql.includes("revoke all on function public.account_usable() from public, anon;"));
});

test("deleting your own account asks for the password and the second step", () => {
  const src = read("../actions/account.ts");
  const action = between(src, "export async function deleteAccountAction", "\n}\n");
  const remove = action.indexOf("admin.auth.admin.deleteUser(");
  const password = action.indexOf("await passwordMatchesCurrent(auth.user.email, currentPassword)");
  const step = action.indexOf('await confirmSecondStep(auth.supabase, auth.user, formData, "account-deletion")');
  assert.ok(password > 0 && password < remove, "password before deletion");
  assert.ok(step > 0 && step < remove, "two-step code before deletion");
});

test("suspended staff are left off the public team page", () => {
  assert.match(read("../data/accounts.ts"), /account\.accountStatus !== "suspended"/);
});
