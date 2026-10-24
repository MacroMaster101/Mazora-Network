import type { User } from "@supabase/supabase-js";
import type { ResetGrantSubject } from "./reset-grant-core";

type EmailUser = Pick<User, "id" | "email" | "email_confirmed_at" | "app_metadata" | "factors">;

/** Only server-managed opt-in metadata and a confirmed, unchanged inbox count. */
export function emailTwoFactorEnrollment(user: EmailUser): { email: string; version: string } | null {
  const saved: unknown = user.app_metadata?.mfa_email_fallback;
  if (!saved || typeof saved !== "object" || !user.email || !user.email_confirmed_at) return null;
  if (!user.factors?.some((factor) => factor.factor_type === "totp" && factor.status === "verified")) return null;
  const value = saved as Record<string, unknown>;
  const email = user.email.trim().toLowerCase();
  if (value.enabled !== true || value.email !== email || typeof value.version !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.version)) return null;
  return { email, version: value.version };
}

/** Changing the inbox or toggling the option invalidates codes and sign-in passes. */
export function emailTwoFactorSubject(user: EmailUser, sessionId: string | null): ResetGrantSubject | null {
  const enrollment = emailTwoFactorEnrollment(user);
  if (!enrollment || !sessionId || !user.id) return null;
  const factors = user.factors!.filter((factor) => factor.factor_type === "totp" && factor.status === "verified").map((factor) => factor.id).sort();
  return { userId: user.id, sessionId: JSON.stringify([sessionId, enrollment.email, enrollment.version, factors]) };
}
