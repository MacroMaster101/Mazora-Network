import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importDiscordAnnouncements } from "@/lib/news/discord-import";

/**
 * Constant-time compare so response timing cannot leak the secret.
 *
 * Both sides are hashed to a fixed 32-byte digest first. Comparing the raw
 * buffers required an `a.length === b.length` guard, because timingSafeEqual
 * throws on a length mismatch — and that guard short-circuits, so a wrong-length
 * secret returned measurably faster than a right-length one and leaked the
 * secret's length. Digests are always the same size, so the compare is
 * unconditional and reveals nothing about the input.
 */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (secret.length < 16) {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  }

  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-cron-secret");
  if (!secretMatches(provided, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // An unexpected throw must still answer with the JSON contract, not a 500.
  let result;
  try {
    result = await importDiscordAnnouncements();
  } catch (error) {
    console.error("Discord news cron failed", error);
    result = { ok: false, imported: 0, skipped: 0, message: "The sync could not run." };
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
