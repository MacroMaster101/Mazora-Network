import "server-only";
import { getDb, schema } from "@/lib/db/client";

export interface AuditEntryInput {
  action: string;
  actorId: string | null;
  /** Username of the staff member, shown as the actor on /admin/audit-logs. */
  by: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Record one staff action in audit_logs.
 *
 * Called after the change has succeeded, so it never throws: a logging
 * failure must not report a completed change as failed. It is logged instead.
 */
export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.auditLogs).values({
      action: entry.action,
      actorId: entry.actorId,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: { by: entry.by, ...entry.metadata },
    });
  } catch (error) {
    console.error(`Audit log write failed for ${entry.action}:`, error);
  }
}
