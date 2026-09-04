import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compare a presented bearer token against the configured secret.
 *
 * `a !== b` on strings stops at the first differing byte, so the time it takes
 * to fail depends on how much of the secret the caller already guessed. That is
 * a side channel — impractical to exploit across a network against a 256-bit
 * secret, but free to close.
 *
 * Both sides are hashed before comparison rather than compared directly:
 * timingSafeEqual throws on a length mismatch, and guarding that with an early
 * `length !== length` return would leak the secret's length instead. Digests
 * are always 32 bytes, so neither problem exists.
 */
export function bearerMatches(offered: string | null | undefined, secret: string): boolean {
  if (!offered || !secret) return false;
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(offered), digest(secret));
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
export function readBearer(header: string | null): string | null {
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}
