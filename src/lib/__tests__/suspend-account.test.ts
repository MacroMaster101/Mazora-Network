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
  const suspended = login.indexOf('(await accountStatusFor(signedIn.user.id)) === "suspended"');
  assert.ok(failed > 0 && suspended > failed, "checked after a wrong password has already been turned away");
  assert.ok(login.indexOf('signOut({ scope: "local" })', suspended) > suspended);
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

test("the Users board locks your own row by account id", () => {
  assert.match(read("../../app/admin/users/page.tsx"), /account\.userId === actorId\) lockedReason = "Your account"/);
});

test("with two-step on, a suspended account learns it only after the code too", () => {
  const auth = read("../actions/auth.ts");
  assert.match(auth, /if \(signedIn\.user && !hasAuthenticator && \(await accountStatusFor\(signedIn\.user\.id\)\) === "suspended"\)/);
  assert.match(read("../../app/auth/callback/route.ts"), /profile\?\.account_status === "suspended" && !hasFactor/);
  const twoFactor = read("../actions/two-factor.ts");
  for (const name of ["verifyTwoFactorAction", "redeemRecoveryCodeAction"]) {
    const start = twoFactor.indexOf(`export async function ${name}`);
    const body = twoFactor.slice(start, twoFactor.indexOf("\n}\n", start));
    assert.match(body, /await refuseIfSuspended\(pending\);/, name);
  }
});

test("a suspended account cannot finish a password reset", () => {
  const auth = read("../actions/auth.ts");
  const reset = between(auth, "export async function finishPasswordResetAction", "\n}\n");
  const check = reset.indexOf('(await accountStatusFor(userData.user.id)) === "suspended"');
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
