import { after, NextResponse } from "next/server";
import { getServerStatus } from "@/lib/data/status";
import { pingDiscordPresence } from "@/lib/data/discord-presence-health";

/** Server-side status endpoint. getServerStatus coalesces requests in a short live cache. */
export const dynamic = "force-dynamic";

export async function GET() {
  // The presence worker reads this endpoint every minute. Returning a
  // background health request creates a lightweight keep-awake loop without
  // delaying the Minecraft status response or requiring a Vercel cron job.
  after(pingDiscordPresence);
  const status = await getServerStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
