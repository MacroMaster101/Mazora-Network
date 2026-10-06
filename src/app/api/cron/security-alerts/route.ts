import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { deliverSecurityAlerts, pruneSentSecurityAlerts } from "@/lib/security-alerts";

/**
 * Backstop for "sign-in method added" alerts (migration 079). Most go out at
 * once, from the site's own add-a-passkey / set-up-2FA actions or the next
 * sign-in; this sends whatever was added elsewhere and not yet reported, then
 * removes alerts sent more than 90 days ago.
 *
 * Scheduled daily in vercel.json.
 */
export async function GET(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  let result: { ok: boolean; sent: number; pruned: number };
  try {
    let sent = 0;
    let ok = true;
    // A batch at a time until the queue is empty, within the function's time.
    for (let round = 0; round < 10; round += 1) {
      const batch = await deliverSecurityAlerts();
      ok = batch.ok;
      sent += batch.sent;
      if (!batch.ok || batch.sent === 0) break;
    }
    result = { ok, sent, pruned: await pruneSentSecurityAlerts() };
  } catch (error) {
    console.error("Security alerts cron failed", error);
    result = { ok: false, sent: 0, pruned: 0 };
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
