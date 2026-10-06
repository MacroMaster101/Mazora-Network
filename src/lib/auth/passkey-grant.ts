import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey, signSessionGrant, verifySessionGrant, type ResetGrantSubject } from "@/lib/auth/reset-grant-core";

/**
 * The "you confirmed it's you" pass for adding passkeys.
 *
 * A passkey is a new way into the account, so adding one needs the owner
 * again (authenticator code, password, or a fresh sign-in: confirmOwner in
 * actions/passkeys). Like GitHub's sudo mode, that confirmation then holds for
 * 15 minutes, so adding a second passkey right away does not ask again.
 *
 * Short-lived, bound to the user and this sign-in's session id, signed with
 * its own purpose key (it can never verify as another grant), httpOnly.
 */

const COOKIE = "mz_passkey_confirmed";
const TTL_SECONDS = 15 * 60;

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "passkey-add") : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function issuePasskeyGrant(subject: ResetGrantSubject): Promise<boolean> {
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

export async function hasPasskeyGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  return verifySessionGrant((await cookies()).get(COOKIE)?.value, subject, k, nowSeconds());
}
