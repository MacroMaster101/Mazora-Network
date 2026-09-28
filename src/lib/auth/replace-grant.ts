import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey, signSessionGrant, verifySessionGrant, type ResetGrantSubject } from "@/lib/auth/reset-grant-core";

/**
 * The "you confirmed it's you" pass for replacing an authenticator.
 *
 * Replacing is two requests: start (new QR code) and confirm (the new app's
 * first code, which also removes the old authenticator). The old
 * authenticator's code — or a recovery code — is asked for at the start, and
 * this signed cookie carries that to the confirm step. Without it, the new
 * app's own code would be enough to throw the old one away, so a signed-in
 * browser alone could take over the account's second factor.
 *
 * Short-lived, bound to the user and this sign-in's session id, signed with
 * its own purpose key, and cleared once the new authenticator is confirmed.
 */

const COOKIE = "mz_mfa_replace";
const TTL_SECONDS = 15 * 60;

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "mfa-replace-authenticator") : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function issueReplaceGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  (await cookies()).set(COOKIE, signSessionGrant(subject, k, nowSeconds(), TTL_SECONDS), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return true;
}

export async function hasReplaceGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  return verifySessionGrant((await cookies()).get(COOKIE)?.value, subject, k, nowSeconds());
}

export async function clearReplaceGrant(): Promise<void> {
  try {
    (await cookies()).delete(COOKIE);
  } catch {
    // Server Components cannot write cookies; the grant is short-lived and session-bound anyway.
  }
}
