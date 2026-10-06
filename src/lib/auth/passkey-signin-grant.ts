import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey, signSessionGrant, verifySessionGrant, type ResetGrantSubject } from "@/lib/auth/reset-grant-core";

/**
 * The passkey sign-in pass: "this exact session signed in with a passkey that
 * verified the member" (fingerprint, face or device PIN).
 *
 * Such a passkey is two factors in one step, something you have (the key on the
 * device) and something you are or know (what unlocks it), and it cannot be
 * phished. GitHub, Google and Microsoft therefore skip the authenticator code
 * after one. Supabase still issues an aal1 session for a passkey sign-in, so,
 * as with a recovery code (lib/auth/recovery-grant), this signed cookie tells
 * getAuthState the second step is done. It is issued only when the signed
 * authenticator data says the device verified the member (the UV flag; see
 * lib/passkeys/user-verified), never for a key that only proved presence.
 *
 * Bound to the user and the session id (which survives token refreshes),
 * signed with its own purpose key, and only honoured on a session whose token
 * says it was a passkey sign-in. It grants nothing a recovery sign-in does
 * beyond passing the two-step check.
 */

const COOKIE = "mz_passkey_signin";
/** Matches the longest a Mazora session realistically lives between sign-ins (as the recovery pass). */
const TTL_SECONDS = 30 * 24 * 60 * 60;

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "passkey-sign-in") : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function issuePasskeySignInGrant(subject: ResetGrantSubject): Promise<boolean> {
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

export async function hasPasskeySignInGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  return verifySessionGrant((await cookies()).get(COOKIE)?.value, subject, k, nowSeconds());
}

export async function clearPasskeySignInGrant(): Promise<void> {
  try {
    (await cookies()).delete(COOKIE);
  } catch {
    // Server Components cannot write cookies; the grant is session-bound anyway.
  }
}
