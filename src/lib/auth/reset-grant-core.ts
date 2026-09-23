import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure signing for the password-reset grant (see reset-grant.ts).
 *
 * The grant proves "this session was created by a recovery verification",
 * which a session cookie alone cannot: without it, finishPasswordResetAction
 * would let anyone holding an ordinary session (an unattended device, a copied
 * cookie) set a new password without the current one — the exact takeover
 * updatePasswordAction's current-password check exists to stop.
 *
 * Bound to the user AND the session: a grant copied into another session, or
 * kept after signing in again, does not verify.
 */

export const RESET_GRANT_TTL_SECONDS = 15 * 60;

export interface ResetGrantSubject {
  userId: string;
  sessionId: string;
}

/** A purpose-bound HMAC key, so the source secret is never used directly. */
export function deriveResetGrantKey(secret: string): Buffer {
  return createHash("sha256").update(`mazora:password-reset-grant:v1:${secret}`).digest();
}

function mac(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function signResetGrant(subject: ResetGrantSubject, key: Buffer, nowSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ u: subject.userId, s: subject.sessionId, e: nowSeconds + RESET_GRANT_TTL_SECONDS }),
  ).toString("base64url");
  return `${payload}.${mac(payload, key)}`;
}

/** True only for an unexpired grant signed with `key` for exactly this user and session. */
export function verifyResetGrant(
  token: string | null | undefined,
  subject: ResetGrantSubject,
  key: Buffer,
  nowSeconds: number,
): boolean {
  if (!token || !subject.userId || !subject.sessionId) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return false;
  const payload = token.slice(0, dot);
  const offered = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(payload, key));
  if (offered.length !== expected.length || !timingSafeEqual(offered, expected)) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; s?: unknown; e?: unknown };
    return (
      claims.u === subject.userId &&
      claims.s === subject.sessionId &&
      typeof claims.e === "number" &&
      claims.e > nowSeconds
    );
  } catch {
    return false;
  }
}
