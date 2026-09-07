import "server-only";
import { and, lt, notInArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { AUDIT_LOG_TTL_MS, PERMANENT_AUDIT_ACTIONS } from "@/lib/audit-retention";

export interface AuditCleanupResult {
  ok: boolean;
  deleted: number;
  message?: string;
}

/**
 * Deletes audit entries older than the TTL, except the handful of actions that
 * are kept permanently.
 *
 * Expressed as one predicate rather than select-then-delete: the rule states
 * cleanly in SQL, and a single statement avoids reading a potentially large id
 * list into memory only to send it straight back. `selectExpiredAuditLogs` in
 * lib/audit-retention.ts states the same rule in a unit-testable form and is
 * the reference for what this must do — the two must not drift.
 *
 * The comparison is `<` so an entry exactly at the cutoff survives, matching
 * the pure rule. `notInArray` mirrors the permanent-action set from the same
 * module, so adding an action there is the only change needed to protect it.
 */
export async function cleanupExpiredAuditLogs(now = Date.now()): Promise<AuditCleanupResult> {
  const db = getDb();
  if (!db) return { ok: false, deleted: 0, message: "The database is not connected." };

  const cutoff = new Date(now - AUDIT_LOG_TTL_MS);
  const permanent = [...PERMANENT_AUDIT_ACTIONS];

  try {
    const removed = await db
      .delete(schema.auditLogs)
      .where(and(lt(schema.auditLogs.createdAt, cutoff), notInArray(schema.auditLogs.action, permanent)))
      .returning({ id: schema.auditLogs.id });

    return { ok: true, deleted: removed.length };
  } catch (error) {
    console.error("Audit log cleanup failed", error);
    return { ok: false, deleted: 0, message: "The cleanup could not run." };
  }
}
