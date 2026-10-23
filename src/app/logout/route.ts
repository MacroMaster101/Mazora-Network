import { NextResponse } from "next/server";
import { destroySession, getSessionUserId } from "@/lib/auth";
import { recordLeaving } from "@/lib/data/presence";
import { site } from "@/lib/site";

/** A browser always sends Origin on a cross-site POST; reject one that is not ours. */
function isForeignOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin !== new URL(site.url).origin && origin !== new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (isForeignOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const receivedAt = new Date();
  // Signing out leaves the site as far as the online lists are concerned.
  // Read the id first: it is gone once the session is.
  const userId = await getSessionUserId().catch(() => null);
  if (userId) await recordLeaving(userId, receivedAt);
  await destroySession();
  return NextResponse.redirect(new URL("/", site.url), { status: 303 });
}
