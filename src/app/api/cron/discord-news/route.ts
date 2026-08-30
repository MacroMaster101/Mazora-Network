import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { importDiscordAnnouncements } from "@/lib/news/discord-import";
import { pingUpstash } from "@/lib/upstash-keep-alive";

export async function GET(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  // Keep the free-tier rate-limit store active even when the site has no auth
  // or submission traffic. PING is read-only and does not create a dummy key.
  const redisKeepAlive = await pingUpstash();

  // An unexpected throw must still answer with the JSON contract, not a 500.
  let result;
  try {
    result = await importDiscordAnnouncements();
  } catch (error) {
    console.error("Discord news cron failed", error);
    result = { ok: false, imported: 0, skipped: 0, message: "The sync could not run." };
  }

  return NextResponse.json({ ...result, redisKeepAlive }, {
    status: result.ok && redisKeepAlive.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
