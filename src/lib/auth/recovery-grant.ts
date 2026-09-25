import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey, signSessionGrant, verifySessionGrant, type ResetGrantSubject } from "@/lib/auth/reset-grant-core";

/**
 * The recovery-code sign-in pass.
 *
 * A recovery code cannot raise a Supabase session to aal2 — only a factor can.
 * So when a member signs in with one, this signed cookie records "this exact
 * session passed two-step verification with a recovery code", and getSession
 * accepts it in place of aal2. That is the industry-standard behaviour: the
 * code is spent, but two-step verification, the authenticator and the other
 * codes all stay; the member can replace the authenticator from Settings.
 *
 * Bound to the user and the session id (which survives token refreshes), and
 * signed with its own purpose key, so it cannot be moved to another session or
 * mistaken for a password-reset grant. Signing out ends the session and with
 * it any use of this cookie.
 */

const COOKIE = "mz_mfa_recovered";
/** Matches the longest a Mazora session realistically lives between sign-ins. */
const TTL_SECONDS = 30 * 24 * 60 * 60;

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "mfa-recovery-sign-in") : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function issueRecoveryGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  (await cookies()).set(COOKIE, signSessionGrant(subject, k, nowSeconds(), TTL_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return true;
}

export async function hasRecoveryGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  return verifySessionGrant((await cookies()).get(COOKIE)?.value, subject, k, nowSeconds());
}

export async function clearRecoveryGrant(): Promise<void> {
  try {
    (await cookies()).delete(COOKIE);
  } catch {
    // Server Components cannot write cookies; the grant is session-bound anyway.
  }
}
