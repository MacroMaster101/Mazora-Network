import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { cleanupReadNotifications } from "@/lib/data/cleanup-notifications";

/**
 * Reaps read notifications past their TTL. Nothing deleted notifications
 * before this, so the table grew without bound — an account signing in daily
 * accumulated a security notice a day, permanently.
 *
 * Scheduled daily in vercel.json, alongside the unconfirmed-account reaper.
 * Unread notifications are never deleted, so this can never take away
 * something a member has not seen.
 */
export async function GET(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  // An unexpected throw must still answer with the JSON contract, not a 500.
  let result;
  try {
    result = await cleanupReadNotifications();
  } catch (error) {
    console.error("Notification cleanup cron failed", error);
    result = { ok: false, deleted: 0, message: "The cleanup could not run." };
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
