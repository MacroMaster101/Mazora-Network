import { NextResponse } from "next/server";

/**
 * Cheap liveness check for uptime monitors.
 *
 * Point monitors here, not at "/": the homepage is the most expensive render on
 * the site, and a monitor loading it every minute was a large share of the
 * Vercel function CPU. This proves the deployment is up and serving functions
 * without touching the database, Supabase or the Minecraft server.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
