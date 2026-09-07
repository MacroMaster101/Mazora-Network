import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { cleanupExpiredAuditLogs } from "@/lib/data/cleanup-audit-logs";

/**
 * Reaps audit entries past their TTL. Nothing pruned audit_logs before this,
 * so the table only grew — it is the one table in the public schema that
 * expands purely with staff activity and had nothing bounding it.
 *
 * Scheduled weekly rather than daily in vercel.json: the table gains a handful
 * of rows a day, and a year-old cutoff does not care which day of the week it
 * runs. The other reapers are daily because their inputs churn far faster.
 *
 * Role changes, account deletions and invites are never deleted — see
 * PERMANENT_AUDIT_ACTIONS.
 */
export async function GET(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  // An unexpected throw must still answer with the JSON contract, not a 500.
  let result;
  try {
    result = await cleanupExpiredAuditLogs();
  } catch (error) {
    console.error("Audit log cleanup cron failed", error);
    result = { ok: false, deleted: 0, message: "The cleanup could not run." };
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
