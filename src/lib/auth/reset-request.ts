import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey } from "@/lib/auth/reset-grant-core";
import {
  RESET_REQUEST_TTL_SECONDS,
  resetRequestPending,
  signResetRequest,
  verifyResetRequest,
} from "@/lib/auth/reset-request-core";

/**
 * Ties an emailed reset LINK to the browser that asked for the reset.
 *
 * Anyone can request a reset for their OWN account and send the link to
 * someone else. Without this, one click on "Reset" signed that person into the
 * sender's account: the same login CSRF the sign-up link is guarded against
 * with its pending-signup cookie.
 *
 * Asking for a reset leaves this marker in the browser, signed for the email
 * that was typed. The link is only honoured where the marker is present and
 * was signed for the account the link belongs to. The 6-digit code needs no
 * marker: typing it already takes both the email address and the code.
 *
 * Set on every request, whether or not the account exists, so it reveals
 * nothing. One marker per browser: asking again for another address replaces it.
 */
const RESET_REQUEST_COOKIE = "mz_pw_reset_req";

function requestKey(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "password-reset-request") : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Call for every reset request, before anything that depends on the account. */
export async function markResetRequested(email: string): Promise<void> {
  const key = requestKey();
  // No key, no marker: the link then falls back to the code, which still works.
  if (!key) return;
  (await cookies()).set(RESET_REQUEST_COOKIE, signResetRequest(email, key, nowSeconds()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RESET_REQUEST_TTL_SECONDS,
  });
}

/** Whether this browser asked for a reset recently. Check before spending the emailed token. */
export async function hasResetRequestMarker(): Promise<boolean> {
  return resetRequestPending((await cookies()).get(RESET_REQUEST_COOKIE)?.value, nowSeconds());
}

/** Whether this browser asked for the reset of exactly this account. Fails closed. */
export async function resetRequestedHereFor(email: string | null | undefined): Promise<boolean> {
  const key = requestKey();
  if (!key) return false;
  return verifyResetRequest((await cookies()).get(RESET_REQUEST_COOKIE)?.value, email, key, nowSeconds());
}

export async function clearResetRequestMarker(): Promise<void> {
  (await cookies()).delete(RESET_REQUEST_COOKIE);
}
