import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSignInSessionId } from "@/lib/auth";
import { consumeEmailProofCode } from "@/lib/auth/account-deletion-proof";
import { accountHasPassword, confirmSecondStep, passwordMatchesCurrent } from "@/lib/auth/reauth";
import { ownerProofKind, type OwnerProof } from "@/lib/auth/owner-proof-kind";
import { throttleAuthAction, throttleCurrentPasswordCheck } from "@/lib/rate-limit";

/**
 * "Confirm it's you": the owner, again, right now, before a change that adds a
 * way into the account or a lock on it (see lib/auth/owner-grant). Passing it
 * issues the 15-minute owner pass those changes check.
 *
 * It used to accept "signed in within the last 15 minutes" for accounts with no
 * password, read from the account's last sign-in time. That is account-wide: the
 * owner signing in on their phone made an old session on another computer pass
 * too. An account with no password and no authenticator proves its inbox
 * instead: a single-use code emailed to it, bound to this session.
 */

const UNAVAILABLE = "That couldn't be checked right now. Please try again.";

/** The owner pass and the emailed code are bound to this user and this sign-in's session. */
export async function ownerGrantSubject(userId: string) {
  return { userId, sessionId: (await getSignInSessionId()) ?? "" };
}

/** What "Confirm it's you" asks this account for, or null when its factors can't be read. */
export async function ownerProofFor(supabase: SupabaseClient, user: User): Promise<OwnerProof | null> {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  return ownerProofKind({ hasAuthenticator: factors.totp.length > 0, hasPassword: accountHasPassword(user) });
}

/** Returns an error message, or null when the owner is confirmed. */
export async function confirmAccountOwner(supabase: SupabaseClient, user: User, formData: FormData): Promise<string | null> {
  const proof = await ownerProofFor(supabase, user);
  if (!proof) return UNAVAILABLE;

  if (proof === "code") return confirmSecondStep(supabase, user, formData, "two-step-settings");

  if (proof === "password") {
    const password = String(formData.get("password") ?? "");
    if (!password) return "Enter your current password.";
    const throttled = await throttleAuthAction("reauth-password", { limit: 5, windowMs: 15 * 60_000, identity: user.id });
    if (throttled) return throttled;
    // Shared with every other current-password check (lib/rate-limit).
    const throttledCheck = await throttleCurrentPasswordCheck(user.id);
    if (throttledCheck) return throttledCheck;
    if (!user.email || !(await passwordMatchesCurrent(user.email, password))) return "That password is incorrect.";
    return null;
  }

  const emailCode = String(formData.get("emailCode") ?? "");
  if (!emailCode) return "Enter the code we emailed you.";
  const throttled = await throttleAuthAction("owner-email-code", { limit: 5, windowMs: 15 * 60_000, identity: user.id });
  if (throttled) return throttled;
  if (!(await consumeEmailProofCode("account-change", await ownerGrantSubject(user.id), emailCode))) {
    return "That code is wrong or has expired. Send a new one.";
  }
  return null;
}
