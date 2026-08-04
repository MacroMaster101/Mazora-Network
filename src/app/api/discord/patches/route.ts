import { NextResponse } from "next/server";
import { getPatchUpdates } from "@/lib/data/patches";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId") || "1193207365906997379";

  try {
    const patches = await getPatchUpdates(channelId);
    return NextResponse.json({ ok: true, channelId, patches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch channel patches";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
