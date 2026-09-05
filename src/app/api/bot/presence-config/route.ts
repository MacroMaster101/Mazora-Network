import { NextResponse } from "next/server";
import { bearerMatches, readBearer } from "@/lib/bot-config-auth";
import { getBotPresenceConfig } from "@/lib/data/bot-presence-config";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";

/** Config must never be served from a cache; the worker polls for changes. */
export const dynamic = "force-dynamic";

/**
 * Read-only config feed for the Render presence worker.
 *
 * Guarded by a shared secret rather than a session because the caller is a
 * machine with no user. The payload contains no credentials — only status text
 * and intervals — so the secret protects against nuisance edits being read,
 * not against disclosure of anything sensitive.
 *
 * When BOT_CONFIG_SECRET is unset the route refuses every request. Failing
 * closed matters more than convenience here: an unset secret in production
 * would otherwise publish the endpoint to anyone who guessed the path.
 */
export async function GET(request: Request): Promise<NextResponse> {
  /*
    Bounded before the secret is even read, so an unauthenticated flood costs
    nothing beyond the counter. The ceiling is deliberately far above what the
    worker needs — it polls once per refresh interval, 60s by default — because
    this exists to cap nuisance traffic, not to ration the legitimate caller.
  */
  const limit = rateLimit(clientKey(request, "bot-presence-config"), { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: retryAfterHeaders(limit.retryAfter) },
    );
  }

  const secret = process.env.BOT_CONFIG_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const offered = readBearer(request.headers.get("authorization"));
  if (!bearerMatches(offered, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = await getBotPresenceConfig();
  return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
}
