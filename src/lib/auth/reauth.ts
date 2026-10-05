import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { throttleAuthAction } from "@/lib/rate-limit";
import { redeemRecoveryCode } from "@/lib/auth/two-factor-recovery";

/**
 * Proving it is really the account owner, again, before something that cannot
 * be taken back: changing the password, turning two-step verification off,
 * replacing the authenticator, reissuing recovery codes, deleting the account.
 * A signed-in browser alone is not enough for those — an unlocked computer or
 * a copied cookie would be.
 *
 * Shared here (not in a "use server" file, where every export becomes a
 * callable action) so each of those actions applies the same rules.
 */

const CODE_PATTERN = /^\d{6}$/;
const UNAVAILABLE = "Two-step verification is unavailable right now. Please try again.";

/** The six-digit authenticator code from a form, or null. */
export function readAuthenticatorCode(formData: FormData): string | null {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * True if `password` is the account's current password. Uses an isolated,
 * non-persisting client so the probe sign-in never touches the real session
 * cookies.
 */
export async function passwordMatchesCurrent(email: string, password: string): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;
  const probe = createClient(config.url, config.key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Whether the account has a password to prove.
 *
 * `identities` is managed by GoTrue and answers the common case. It cannot
 * answer the OAuth-user-who-later-set-a-password case, because updateUser({
 * password }) adds no "email" identity — that is what the flag is for, so it
 * lives in `app_metadata`, which only the service role can write.
 *
 * user_metadata is still consulted, but only as an additional way to say *yes*.
 * It can never be used to say no, so forging it buys nothing.
 */
export function accountHasPassword(user: {
  identities?: { provider?: string }[] | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined): boolean {
  if (!user) return false;
  // An explicit "no": the server removed a password it could not trust
  // (lib/auth/signup-trust), and the email identity outlives it. Only the
  // service role can write this, and the next password set turns it back.
  if (user.app_metadata?.has_password === false) return false;
  if ((user.identities ?? []).some((identity) => identity?.provider === "email")) return true;
  if (user.app_metadata?.has_password === true) return true;
  return user.user_metadata?.has_password === true;
}

/**
 * The second step, again, right now: a code from the authenticator app
 * (`code`) or an unused recovery code (`recoveryCode`, the "lost your phone"
 * switch). Counted in the sign-in page's guess bucket, so it adds no guesses.
 * Returns an error message, or null when the step is passed.
 */
export async function confirmSecondStep(
  supabase: SupabaseClient,
  user: User,
  formData: FormData,
  purpose: "two-step-settings" | "account-deletion",
): Promise<string | null> {
  const recoveryInput = String(formData.get("recoveryCode") ?? "").trim();
  const code = readAuthenticatorCode(formData);
  if (!recoveryInput && !code) {
    return formData.has("recoveryCode") ? "Enter one of your recovery codes." : "Enter the six-digit code from your authenticator app.";
  }

  const throttled = await throttleAuthAction("mfa-verify", { limit: 5, windowMs: 15 * 60_000, identity: user.id });
  if (throttled) return throttled;

  if (code) {
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) return UNAVAILABLE;
    for (const factor of factors.totp) {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (!error) return null;
    }
    return "That code is incorrect or has expired.";
  }

  const outcome = await redeemRecoveryCode(user, recoveryInput, purpose);
  return outcome.ok ? null : "That recovery code is incorrect or has already been used.";
}
