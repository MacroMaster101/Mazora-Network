import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure signing for the "this browser asked for the reset" marker (see
 * reset-request.ts).
 *
 * The marker is `<expiry>.<mac>`, where the MAC covers the expiry and the
 * email the reset was requested for. The email itself is never in the cookie,
 * and without the server-only key the MAC says nothing about it.
 */

/** As long as the emailed reset link lasts (Supabase's default email OTP expiry). */
export const RESET_REQUEST_TTL_SECONDS = 60 * 60;

const normaliseEmail = (email: string) => email.trim().toLowerCase();

function mac(expiry: number, email: string, key: Buffer): string {
  return createHmac("sha256", key).update(`${expiry}:${normaliseEmail(email)}`).digest("base64url");
}

export function signResetRequest(email: string, key: Buffer, nowSeconds: number): string {
  const expiry = nowSeconds + RESET_REQUEST_TTL_SECONDS;
  return `${expiry}.${mac(expiry, email, key)}`;
}

function expiryOf(token: string | null | undefined): number | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const expiry = Number(token.slice(0, dot));
  return Number.isSafeInteger(expiry) ? expiry : null;
}

/**
 * Whether the browser carries a marker that has not run out. Checked before the
 * emailed token is spent, when the account is not known yet, so it proves
 * nothing on its own: it only stops a stray click from burning the link.
 */
export function resetRequestPending(token: string | null | undefined, nowSeconds: number): boolean {
  const expiry = expiryOf(token);
  return expiry !== null && expiry > nowSeconds;
}

/** True only for an unexpired marker signed with `key` for exactly this email. */
export function verifyResetRequest(
  token: string | null | undefined,
  email: string | null | undefined,
  key: Buffer,
  nowSeconds: number,
): boolean {
  const expiry = expiryOf(token);
  if (!token || !email || expiry === null || expiry <= nowSeconds) return false;
  const offered = Buffer.from(token.slice(token.indexOf(".") + 1));
  const expected = Buffer.from(mac(expiry, email, key));
  return offered.length === expected.length && timingSafeEqual(offered, expected);
}
