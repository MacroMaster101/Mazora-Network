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

/** Changing the inbox or toggling the option invalidates codes and sign-in passes. */
export function emailTwoFactorSubject(user: EmailUser, sessionId: string | null): ResetGrantSubject | null {
  const enrollment = emailTwoFactorEnrollment(user);
  if (!enrollment || !sessionId || !user.id) return null;
  const factors = user.factors!.filter((factor) => factor.factor_type === "totp" && factor.status === "verified").map((factor) => factor.id).sort();
  return { userId: user.id, sessionId: JSON.stringify([sessionId, enrollment.email, enrollment.version, factors]) };
}
