import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { needsTwoFactor } from "@/lib/auth/roles";
import { deriveGrantKey, deriveResetGrantKey, signSessionGrant, verifySessionGrant } from "@/lib/auth/reset-grant-core";
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  hashRecoveryCode,
  normaliseRecoveryCode,
} from "@/lib/auth/recovery-codes-core";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("a sign-in owes its code only when the account has an authenticator", () => {
  assert.equal(needsTwoFactor("aal1", true), true);
  assert.equal(needsTwoFactor(undefined, true), true);
  assert.equal(needsTwoFactor("aal2", true), false);
  // Optional: no authenticator, never asked.
  assert.equal(needsTwoFactor("aal1", false), false);
});

test("an owed code is a signed-out session, not a downgraded one", () => {
  const src = read("../auth/index.ts");
  // getSession and getAuthUser (behind getSessionUserId) both refuse it.
  assert.match(src, /if \(needsTwoFactor\(state\.aal, state\.hasAuthenticator\)\) return null;/);
  assert.match(src, /if \(!state \|\| needsTwoFactor\(state\.aal, state\.hasAuthenticator\)\) return null;/);
  assert.doesNotMatch(src, /pendingStaffRole/);
});

test("the authenticator check reads the auth server's user, not the cookie", () => {
  const src = read("../auth/index.ts");
  assert.match(src, /data\.user\.factors\?\.some\(\(factor\) => factor\.status === "verified"\)/);
});

test("actions that read the user directly also refuse an owed code", () => {
  for (const file of ["../actions/account.ts", "../actions/avatar.ts", "../actions/minecraft.ts"]) {
    assert.match(read(file), /if \(await isTwoFactorPending\(\)\) return null;/, file);
  }
  const auth = read("../actions/auth.ts");
  assert.ok((auth.match(/isTwoFactorPending\(\)/g) ?? []).length >= 5, "password change, linking and Discord actions");
});

test("changing two-step settings needs a completed sign-in", () => {
  const src = read("../actions/two-factor.ts");
  for (const name of ["startTwoFactorEnrollmentAction", "confirmTwoFactorSetupAction", "regenerateRecoveryCodesAction", "disableTwoFactorAction"]) {
    const body = src.slice(src.indexOf(`export async function ${name}`));
    assert.match(body.slice(0, 300), /await signedIn\(\)/, name);
  }
});

test("072 gates every RLS table on an aal2 token once two-step is on", () => {
  const sql = read("../../../supabase/migrations/072_two_factor_login_gate.sql");
  assert.ok(sql.includes("create or replace function public.mfa_satisfied()"));
  assert.ok(sql.includes("coalesce(auth.jwt() ->> 'aal', '') = 'aal2'"));
  assert.ok(sql.includes("from auth.mfa_factors f"));
  assert.ok(sql.includes("as restrictive for all to authenticated"));
});

test("073 keeps recovery codes out of reach of the Data API", () => {
  const sql = read("../../../supabase/migrations/073_mfa_recovery_codes.sql");
  assert.ok(sql.includes("enable row level security"));
  assert.ok(sql.includes("revoke all on public.mfa_recovery_codes from anon, authenticated;"));
  assert.doesNotMatch(sql, /create policy/i);
});

test("recovery codes are unique, readable and forgiving to type", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, RECOVERY_CODE_COUNT);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) {
    assert.match(code, /^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
    assert.equal(normaliseRecoveryCode(code.toLowerCase().replace("-", " ")), code.replace("-", ""));
  }
  assert.equal(normaliseRecoveryCode("short"), null);
  assert.equal(normaliseRecoveryCode("OOOOO-11111"), null);
});

test("recovery code hashes are salted per account", () => {
  const code = normaliseRecoveryCode(generateRecoveryCodes(1)[0])!;
  assert.notEqual(hashRecoveryCode("user-a", code), hashRecoveryCode("user-b", code));
  assert.equal(hashRecoveryCode("user-a", code), hashRecoveryCode("user-a", code));
});

test("pages send signed-out visitors through requireSession, not straight to login", () => {
  // A direct redirect("/login…") skips the owed-code check and bounces a
  // half-signed-in member to the login form instead of /two-factor.
  for (const file of ["../../app/dashboard/layout.tsx", "../../app/admin/page.tsx", "../../app/admin/layout.tsx"]) {
    assert.doesNotMatch(read(file), /redirect\(\s*["'`]\/login/, file);
  }
});

test("password reset on a two-step account also needs the second factor", () => {
  const src = read("../actions/auth.ts");
  const reset = src.slice(src.indexOf("export async function finishPasswordResetAction"));
  const gate = reset.indexOf("if (await isTwoFactorPending())");
  const update = reset.indexOf("supabase.auth.updateUser(");
  assert.ok(gate > 0 && gate < update, "the two-step check runs before the password is changed");
  assert.match(src, /mfa\.challengeAndVerify\(\{ factorId: factor\.id, code: mfaCode \}\)/);
  // A recovery code is the same shared rule as on the sign-in page.
  assert.match(src, /await redeemRecoveryCode\(user, recoveryCode, "password-reset"\)/);
  assert.match(read("../actions/two-factor.ts"), /await redeemRecoveryCode\(pending\.user, input, "sign-in"\)/);
});

test("a recovery code works the industry-standard way: spent, but two-step stays on", () => {
  const helper = read("../auth/two-factor-recovery.ts");
  const redeem = helper.slice(helper.indexOf("export async function redeemRecoveryCode"), helper.indexOf("export async function removeFactor"));
  // Spending a code removes nothing else: no factors, no other codes.
  assert.doesNotMatch(redeem, /deleteFactor|clearRecoveryCodes/);
  assert.match(redeem, /consumeRecoveryCode\(user\.id, input\)/);
  // The sign-in then carries a recovery pass the gate accepts.
  assert.match(read("../actions/two-factor.ts"), /issueRecoveryGrant\(\{ userId: pending\.user\.id, sessionId \}\)/);
  assert.match(read("../auth/index.ts"), /const aal: "aal1" \| "aal2" = recovered \? "aal2" : token\.aal;/);
});

test("a recovery pass is bound to one session and cannot pass as a reset grant", () => {
  const secret = "test-secret";
  const recoveryKey = deriveGrantKey(secret, "mfa-recovery-sign-in");
  const subject = { userId: "user-1", sessionId: "session-1" };
  const pass = signSessionGrant(subject, recoveryKey, 1_000, 60);
  assert.equal(verifySessionGrant(pass, subject, recoveryKey, 1_030), true);
  assert.equal(verifySessionGrant(pass, { ...subject, sessionId: "session-2" }, recoveryKey, 1_030), false);
  assert.equal(verifySessionGrant(pass, subject, recoveryKey, 1_061), false, "expires");
  assert.equal(verifySessionGrant(pass, subject, deriveResetGrantKey(secret), 1_030), false, "separate purpose keys");
});

test("replacing an authenticator never leaves the old one working", () => {
  const src = read("../actions/two-factor.ts");
  assert.match(src, /if \(unenrollError\) await removeFactor\(actor\.user\.id, old\.id\);/);
  // Sign-in accepts a code from any authenticator, so a half-finished swap cannot lock anyone out.
  assert.match(src, /for \(const factor of factors\.totp\)/);
});

test("signing out also ends a recovery pass", () => {
  const src = read("../auth/index.ts");
  const destroy = src.slice(src.indexOf("export async function destroySession"));
  assert.match(destroy, /await clearRecoveryGrant\(\);/);
});
