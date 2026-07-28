import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importDiscordAnnouncements } from "@/lib/news/discord-import";

/** Constant-time compare so response timing cannot leak the secret. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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
