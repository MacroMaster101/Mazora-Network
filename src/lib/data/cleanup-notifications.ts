import "server-only";
import { and, isNotNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { NOTIFICATION_TTL_MS } from "@/lib/notification-retention";

export interface NotificationCleanupResult {
  ok: boolean;
  deleted: number;
  message?: string;
}

/**
 * Deletes notifications the member has already READ and that are older than
 * the TTL. Unread rows are never touched, whatever their age — someone who has
 * not opened the bell in months must still find what was waiting for them.
 *
 * The delete is expressed as one predicate rather than select-then-delete: the
 * rule is simple enough to state in SQL, and doing it in a single statement
 * avoids reading a potentially large id list into memory just to send it back.
 * `selectExpiredNotifications` in lib/notification-retention.ts states the same
 * rule in a unit-testable form and is the reference for what this must do.
 */
export async function cleanupReadNotifications(now = Date.now()): Promise<NotificationCleanupResult> {
  const db = getDb();
  if (!db) return { ok: false, deleted: 0, message: "The database is not connected." };

  const cutoff = new Date(now - NOTIFICATION_TTL_MS);

  try {
    const removed = await db
      .delete(schema.notifications)
      .where(and(isNotNull(schema.notifications.readAt), lt(schema.notifications.createdAt, cutoff)))
      .returning({ id: schema.notifications.id });

    return { ok: true, deleted: removed.length };
  } catch (error) {
    console.error("Notification cleanup failed", error);
    return { ok: false, deleted: 0, message: "The cleanup could not run." };
  }
}
