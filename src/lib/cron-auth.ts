import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Constant-time compare so response timing cannot leak the secret.
 *
 * Both sides are hashed to a fixed 32-byte digest first. Comparing the raw
 * buffers would need an `a.length === b.length` guard (timingSafeEqual throws on
 * a length mismatch), and that guard short-circuits — a wrong-length secret
 * would return measurably faster than a right-length one and leak the secret's
 * length. Digests are always the same size, so the compare is unconditional.
 */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Authorise a Vercel Cron request. Returns `null` when the caller is authorised,
 * or the JSON error response to return as-is otherwise. Shared by every cron
 * route so the secret handling cannot drift between them.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; `x-cron-secret` is
 * accepted too for manual invocation.
 */
export function cronAuthError(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (secret.length < 16) {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-cron-secret");
  if (!secretMatches(provided, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return null;
}
