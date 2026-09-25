import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit-log";
import { consumeRecoveryCode, remainingRecoveryCodes } from "@/lib/auth/recovery-codes";

export type RecoveryOutcome = { ok: true; remaining: number } | { ok: false };

/**
 * Spend one recovery code — the industry-standard way.
 *
 * The code is used up and nothing else changes: two-step verification stays
 * on, the authenticator stays linked (a phone that turns up still works), and
 * the other codes stay valid until used or regenerated. The caller decides
 * what the spent code unlocks — a sign-in (a recovery pass for that session)
 * or a password reset.
 *
 * Shared by the sign-in code page and password reset, so both apply exactly
 * the same rule.
 */
export async function redeemRecoveryCode(
  user: Pick<User, "id" | "email" | "user_metadata">,
  input: string,
  purpose: "sign-in" | "password-reset",
): Promise<RecoveryOutcome> {
  if (!(await consumeRecoveryCode(user.id, input))) return { ok: false };
  const remaining = await remainingRecoveryCodes(user.id);

  await recordAudit({
    action: "auth.two_factor_recovery_used",
    actorId: user.id,
    // The email, not user_metadata: members can rewrite their own metadata,
    // so a name taken from it could be made to read as anyone.
    by: user.email ?? user.id,
    targetType: "user",
    targetId: user.id,
    metadata: { purpose, remaining },
  });
  return { ok: true, remaining };
}

/** Remove one factor with the service role; see removeAllFactors for why. */
export async function removeFactor(userId: string, factorId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factorId, userId });
  if (error) console.error("Two-factor removal failed:", { code: error.code, message: error.message });
  return !error;
}

/**
 * Remove every two-step factor from an account with the service role.
 *
 * Supabase only lets a member's own client remove a verified factor from an
 * aal2 session, and a sign-in that used a recovery code is not one. The
 * callers check the member is properly signed in (by code or recovery pass)
 * before calling this.
 */
export async function removeAllFactors(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data, error: listError } = await admin.auth.admin.mfa.listFactors({ userId });
  if (listError) return false;
  for (const factor of data.factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (error) {
      console.error("Two-factor removal failed:", { code: error.code, message: error.message });
      return false;
    }
  }
  return true;
}
