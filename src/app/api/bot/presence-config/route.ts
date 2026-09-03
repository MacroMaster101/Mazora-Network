import { NextResponse } from "next/server";
import { getBotPresenceConfig } from "@/lib/data/bot-presence-config";

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
  const secret = process.env.BOT_CONFIG_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const offered = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (offered !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = await getBotPresenceConfig();
  return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
}
