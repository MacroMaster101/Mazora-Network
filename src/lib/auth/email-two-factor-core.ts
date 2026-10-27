import type { User } from "@supabase/supabase-js";
import type { ResetGrantSubject } from "./reset-grant-core";

type EmailUser = Pick<User, "id" | "email" | "email_confirmed_at" | "app_metadata" | "factors">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Email codes are on by default for every account with a verified
 * authenticator and a confirmed inbox, the way Epic and Steam Guard offer them.
 * Only an explicit opt-out saved in server-managed app_metadata turns them off.
 * The version changes on every toggle, so a pass issued before it stops working.
 */
export function emailTwoFactorEnrollment(user: EmailUser): { email: string; version: string } | null {
  if (!user.email || !user.email_confirmed_at) return null;
  if (!user.factors?.some((factor) => factor.factor_type === "totp" && factor.status === "verified")) return null;
  const saved: unknown = user.app_metadata?.mfa_email_fallback;
  const value = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : null;
  if (value?.enabled === false) return null;
  const version = typeof value?.version === "string" && UUID.test(value.version) ? value.version : "default";
  return { email: user.email.trim().toLowerCase(), version };
}

/** First steps that prove something other than the inbox: a passkey or a password. */
const NON_EMAIL_FIRST_STEPS = new Set(["sso/saml", "passkey", "password"]);
/** Sessions opened from an emailed code or link: a reset, magic link, invite or confirmation. */
const EMAIL_SESSIONS = new Set(["otp", "magiclink", "recovery", "invite", "email/signup", "email_change"]);

/**
 * An email code is a second factor only after a first step the inbox cannot
 * give. A password-reset session is opened from the same inbox, so taking an
 * email code there would let inbox access alone past two-step verification.
 *
 * A Google or Discord sign-in never counts. The Google account may be the
 * mailbox itself, and someone holding the inbox can attach a provider login
 * (Supabase links one with the same verified address, and its address can be
 * changed afterwards), so no check of the provider's address makes it safe.
 */
export function emailTwoFactorAllowedForSignIn(amr: readonly string[]): boolean {
  return amr.some((method) => NON_EMAIL_FIRST_STEPS.has(method)) && !amr.some((method) => EMAIL_SESSIONS.has(method));
}

/** Changing the inbox or toggling the option invalidates codes and sign-in passes. */
export function emailTwoFactorSubject(user: EmailUser, sessionId: string | null): ResetGrantSubject | null {
  const enrollment = emailTwoFactorEnrollment(user);
  if (!enrollment || !sessionId || !user.id) return null;
  const factors = user.factors!.filter((factor) => factor.factor_type === "totp" && factor.status === "verified").map((factor) => factor.id).sort();
  return { userId: user.id, sessionId: JSON.stringify([sessionId, enrollment.email, enrollment.version, factors]) };
}
