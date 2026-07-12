import { NextResponse } from "next/server";
import { getServerStatus } from "@/lib/data/status";

/** Server-side status endpoint. Cached upstream in getServerStatus (revalidate 60s). */
export async function GET() {
  const status = await getServerStatus();
  return NextResponse.json(status);
}
