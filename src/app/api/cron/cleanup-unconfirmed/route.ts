import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { cleanupUnconfirmedAccounts } from "@/lib/data/cleanup-unconfirmed";

/**
 * Reaps abandoned signups: accounts that were created but never confirmed and
 * never signed in, older than the TTL. Without this, an unconfirmed signup
 * holds its username and Minecraft IGN indefinitely, so a name someone never
 * activated stays unavailable to everyone else.
 *
 * Scheduled daily in vercel.json. Deleting each account cascades to its profile
 * and Minecraft link, which is what actually frees the name.
 */
export async function GET(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  // An unexpected throw must still answer with the JSON contract, not a 500.
  let result;
  try {
    result = await cleanupUnconfirmedAccounts();
  } catch (error) {
    console.error("Unconfirmed cleanup cron failed", error);
    result = { ok: false, scanned: 0, deleted: 0, message: "The cleanup could not run." };
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
