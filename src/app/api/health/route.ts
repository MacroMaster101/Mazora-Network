import { NextResponse } from "next/server";
import { probeDatabase } from "@/lib/db/probe";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Health checks for uptime monitors.
 *
 * Point monitors here, not at "/": the homepage is the most expensive render on
 * the site, and a monitor loading it every minute was a large share of the
 * Vercel function CPU.
 *
 * Plain `GET /api/health` (and HEAD) is liveness only: it proves the deployment
 * is up and serving functions without touching the database, Supabase or the
 * Minecraft server.
 *
 * `GET /api/health?deep=1` also runs one trivial query. Every page treats a
 * failed read as "nothing to show", so a database outage otherwise looks like
 * an empty site with a 200 status; this answers 503 instead, which is what a
 * monitor should alert on. The query is `select 1`, bounded by DEEP_CHECK_MS,
 * and rate limited per address so it cannot be used to load the database. The
 * response never says why it failed.
 */
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const DEEP_CHECK_MS = 3_000;

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("deep") !== "1") {
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  const limit = rateLimit(clientKey(request, "health-deep"), { limit: 12, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ ok: false, error: "Too many checks." }, { status: 429, headers: noStore });

  const database = await probeDatabase(DEEP_CHECK_MS);
  const ok = database !== "down";
  return NextResponse.json({ ok, database }, { status: ok ? 200 : 503, headers: noStore });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: noStore });
}
