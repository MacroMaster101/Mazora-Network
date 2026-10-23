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

/*
  The pass above lasts as long as the session, but taking every authenticator
  off the account to set up a new one (the lost-phone replacement) should not:
  a copied recovered session could otherwise start a replacement weeks later,
  abandon it at the QR code and leave two-step verification off. So the sign-in
  also gets a short "just recovered" marker, with its own purpose key. Past it,
  the replacement asks the owner to confirm it's them again.
*/
const FRESH_COOKIE = "mz_mfa_recovered_fresh";
const FRESH_TTL_SECONDS = 15 * 60;

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "mfa-recovery-sign-in") : null;
}

function freshKey(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "mfa-recovery-sign-in-fresh") : null;
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
  const fk = freshKey();
  if (fk) {
    (await cookies()).set(FRESH_COOKIE, signSessionGrant(subject, fk, nowSeconds(), FRESH_TTL_SECONDS), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: FRESH_TTL_SECONDS,
    });
  }
  return true;
}

export async function hasRecoveryGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  return verifySessionGrant((await cookies()).get(COOKIE)?.value, subject, k, nowSeconds());
}

/** True only within 15 minutes of this session's recovery-code sign-in. */
export async function hasFreshRecoveryGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = freshKey();
  if (!k || !subject.sessionId) return false;
  return verifySessionGrant((await cookies()).get(FRESH_COOKIE)?.value, subject, k, nowSeconds());
}

export async function clearRecoveryGrant(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(COOKIE);
    jar.delete(FRESH_COOKIE);
  } catch {
    // Server Components cannot write cookies; the grant is session-bound anyway.
  }
}
