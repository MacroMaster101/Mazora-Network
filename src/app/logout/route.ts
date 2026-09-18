import { NextResponse } from "next/server";
import { destroySession, getSessionUserId } from "@/lib/auth";
import { recordLeaving } from "@/lib/data/presence";
import { site } from "@/lib/site";

export async function POST() {
  const receivedAt = new Date();
  // Signing out leaves the site as far as the online lists are concerned.
  // Read the id first: it is gone once the session is.
  const userId = await getSessionUserId().catch(() => null);
  if (userId) await recordLeaving(userId, receivedAt);
  await destroySession();
  return NextResponse.redirect(new URL("/", site.url), { status: 303 });
}
