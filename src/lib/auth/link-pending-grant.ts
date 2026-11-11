import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey, signSessionGrant, verifySessionGrant } from "@/lib/auth/reset-grant-core";
import { LINK_PENDING_MS } from "@/lib/auth/linked-logins-core";

/**
 * Ties a link started on the site to the browser that started it.
 *
 * The pending link on the account (lib/auth/linked-logins) names only a
 * provider, and the account is the same whoever is using it. Someone holding a
 * copied session could link a Google or Discord account of their own through
 * Supabase's API while the owner's link was on its way, reach the callback
 * first, and have theirs trusted; the owner's was then removed.
 *
 * So starting a link also leaves this cookie in the browser that started it,
 * and the callback trusts the new login only when the cookie matches the
 * pending link's nonce. The nonce sits in app_metadata, which a session holder
 * can read, so the cookie is signed: knowing the nonce is not enough to make
 * one.
 *
 * Signed with its own purpose key, httpOnly, and as short-lived as the pending
 * link. SameSite=Lax, not Strict: it has to come back on the redirect from the
 * provider, which is a cross-site navigation. Sent to the callback only.
 */

const COOKIE = "mz_link_pending";
const PATH = "/auth/callback";
const TTL_SECONDS = LINK_PENDING_MS / 1000;

export function linkPendingKey(secret: string): Buffer {
  return deriveGrantKey(secret, "link-pending");
}

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? linkPendingKey(secret) : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Leaves the cookie for a new link on this account and returns its nonce, for
 * the pending link to carry. Null when it cannot be signed: the link must not
 * start then, because nothing could be trusted when it came back.
 */
export async function issueLinkNonce(userId: string): Promise<string | null> {
  const k = key();
  if (!k || !userId) return null;
  const nonce = randomBytes(18).toString("base64url");
  (await cookies()).set(COOKIE, signSessionGrant({ userId, sessionId: nonce }, k, nowSeconds(), TTL_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: PATH,
    maxAge: TTL_SECONDS,
  });
  return nonce;
}

/** Whether this browser started the pending link that carries `nonce` on this account. */
export async function holdsLinkNonce(userId: string, nonce: string | null): Promise<boolean> {
  const k = key();
  if (!k || !nonce) return false;
  return verifySessionGrant((await cookies()).get(COOKIE)?.value, { userId, sessionId: nonce }, k, nowSeconds());
}

/** The link has come back; the cookie has done its work. */
export async function clearLinkNonce(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: PATH });
}
