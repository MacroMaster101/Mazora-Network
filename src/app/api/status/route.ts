import { NextResponse } from "next/server";
import { getServerStatus } from "@/lib/data/status";

/** Server-side status endpoint. getServerStatus coalesces requests in a short live cache. */
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getServerStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
