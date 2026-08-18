import { NextResponse } from "next/server";
import { getPlayerDetail } from "@/lib/data/player-detail";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const limit = rateLimit(clientKey(request, "player-detail"), { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: retryAfterHeaders(limit.retryAfter) },
    );
  }

  const { username } = await params;
  if (!IGN_PATTERN.test(username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const detail = await getPlayerDetail(username);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
