import { after, NextResponse } from "next/server";
import { getServerStatus } from "@/lib/data/status";
import { pingDiscordPresence } from "@/lib/data/discord-presence-health";
import { recordStatusSample } from "@/lib/data/status-telemetry";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** Server-side status endpoint. getServerStatus coalesces requests in a short live cache. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // The response itself is cheap (getServerStatus coalesces), but each call
  // otherwise schedules an outbound Discord ping and a telemetry write. Cap how
  // often a single client can trigger that background work so the endpoint
  // can't be flooded into amplifying requests downstream. The once-a-minute
  // presence worker stays well under this ceiling, so its keep-awake loop and
  // the 24-hour activity history are unaffected.
  const backgroundOk = rateLimit(clientKey(request, "status:jobs"), {
    limit: 30,
    windowMs: 60_000,
  }).ok;

  // The presence worker reads this endpoint every minute. Returning a
  // background health request creates a lightweight keep-awake loop without
  // delaying the Minecraft status response or requiring a Vercel cron job.
  if (backgroundOk) after(pingDiscordPresence);
  const status = await getServerStatus();

  /*
    That same once-a-minute poll is what builds the 24-hour activity history, so
    the chart on /play plots readings that were actually taken instead of a
    generated curve. In `after()` because it must not add latency here, and it
    swallows its own errors so a telemetry problem can never fail this response.
  */
  if (backgroundOk) after(() => recordStatusSample(status));

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
