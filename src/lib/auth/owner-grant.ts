import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey, signSessionGrant, verifySessionGrant, type ResetGrantSubject } from "@/lib/auth/reset-grant-core";

/**
 * The "you confirmed it's you" pass for changes that add a way into the
 * account, or a lock on it: adding a passkey, linking a Google or Discord
 * login, setting a first password, and turning two-step verification on.
 *
 * A signed-in browser alone is not enough for those: whoever holds a copied
 * session cookie, or sits at an unlocked computer, could otherwise give
 * themselves lasting access and lock the owner out. So the owner is asked
 * again (lib/auth/owner-confirmation). Like GitHub's sudo mode, that
 * confirmation then holds for 15 minutes, so a second change right away does
 * not ask again.
 *
 * Short-lived, bound to the user and this sign-in's session id, signed with
 * its own purpose key (it can never verify as another grant), httpOnly.
 */

const COOKIE = "mz_owner_confirmed";
const TTL_SECONDS = 15 * 60;

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "owner-confirmed") : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function issueOwnerGrant(subject: ResetGrantSubject): Promise<boolean> {
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

export async function hasOwnerGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.sessionId) return false;
  return verifySessionGrant((await cookies()).get(COOKIE)?.value, subject, k, nowSeconds());
}
