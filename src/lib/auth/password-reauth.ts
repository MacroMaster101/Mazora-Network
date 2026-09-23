/**
 * Pure helpers for "Secure password change" (Supabase reauthentication).
 *
 * With that setting on, Supabase refuses a password update from a session
 * older than 24 hours until the user proves they still control the email
 * address: reauthenticate() emails a code, and updateUser({ password, nonce })
 * must carry it. updatePasswordAction uses these to turn Supabase's error codes
 * into the right next step for the Settings form.
 */

export type PasswordUpdateErrorKind = "send-code" | "bad-code" | "other";

export function classifyPasswordUpdateError(code: string | undefined): PasswordUpdateErrorKind {
  if (code === "reauthentication_needed" || code === "reauth_nonce_missing") return "send-code";
  if (code === "reauthentication_not_valid" || code === "otp_expired") return "bad-code";
  return "other";
}

/** The emailed code as digits, or null when it can't be one (spaces are allowed). */
export function normaliseReauthCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\s+/g, "");
  return /^\d{6,10}$/.test(digits) ? digits : null;
}
