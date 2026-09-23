import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RESET_GRANT_TTL_SECONDS,
  deriveResetGrantKey,
  signResetGrant,
  verifyResetGrant,
  type ResetGrantSubject,
} from "@/lib/auth/reset-grant-core";

/**
 * Ties the final "set a new password" step to a session that came from a
 * recovery verification (the emailed 6-digit code or reset link).
 *
 * Issued right after verifyOtp({ type: "recovery" }) succeeds, as an httpOnly
 * cookie signed with a key derived from the server-only service-role secret.
 * finishPasswordResetAction refuses to change a password without it, so a
 * stolen or unattended ordinary session can no longer skip the current-password
 * check that updatePasswordAction enforces.
 */
const RESET_GRANT_COOKIE = "mz_pw_reset";

function grantKey(): Buffer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return secret ? deriveResetGrantKey(secret) : null;
}

/**
 * The verified user and session behind an access token — the given one (just
 * returned by verifyOtp, before its cookies are readable in this request) or
 * else the client's current session.
 */
async function currentSubject(supabase: SupabaseClient, accessToken?: string): Promise<ResetGrantSubject | null> {
  try {
    const { data, error } = await supabase.auth.getClaims(accessToken);
    const claims = data?.claims as { sub?: unknown; session_id?: unknown } | undefined;
    if (error || typeof claims?.sub !== "string" || typeof claims?.session_id !== "string") return null;
    return { userId: claims.sub, sessionId: claims.session_id };
  } catch {
    // getClaims rethrows non-auth errors (an odd `alg`, a failed key import).
    // Treat them as "no verified session" rather than a 500.
    return null;
  }
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Call only after a successful recovery verifyOtp, with the session it returned.
 * False when the grant could not be issued, so the caller can say so now rather
 * than let the member reach step 3 and be told their session expired.
 */
export async function issueResetGrant(supabase: SupabaseClient, accessToken: string | undefined): Promise<boolean> {
  const key = grantKey();
  if (!accessToken || !key) return false;
  const subject = await currentSubject(supabase, accessToken);
  if (!subject) return false;
  (await cookies()).set(RESET_GRANT_COOKIE, signResetGrant(subject, key, nowSeconds()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RESET_GRANT_TTL_SECONDS,
  });
  return true;
}

/** Whether this session may set a new password without the current one. Fails closed. */
export async function hasResetGrant(supabase: SupabaseClient): Promise<boolean> {
  const key = grantKey();
  const subject = await currentSubject(supabase);
  if (!key || !subject) return false;
  const token = (await cookies()).get(RESET_GRANT_COOKIE)?.value;
  return verifyResetGrant(token, subject, key, nowSeconds());
}

export async function clearResetGrant(): Promise<void> {
  (await cookies()).delete(RESET_GRANT_COOKIE);
}
