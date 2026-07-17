import { NextResponse } from "next/server";
import { getDiscordIdentity } from "@/lib/auth";

/** Discord identity of the current visitor, for pre-filling the order form. */
export async function GET() {
  const discord = await getDiscordIdentity();
  return NextResponse.json({ discord }, { headers: { "Cache-Control": "no-store" } });
}
