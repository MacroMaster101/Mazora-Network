import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { NOTIFICATION_TTL_MS, UNREAD_NOTIFICATION_TTL_MS } from "@/lib/notification-retention";

export interface NotificationCleanupResult {
  ok: boolean;
  deleted: number;
  message?: string;
}

/** Rows one statement deletes, so a backlog never becomes one long, lock-heavy delete. */
const DELETE_BATCH = 5_000;
/** Batches per run; the next nightly run carries on with whatever is left. */
const MAX_BATCHES = 40;
/** Stop starting batches past this, inside the cron's 30s function limit. */
const RUN_BUDGET_MS = 20_000;

/**
 * Deletes notifications the member has already READ that are older than the
 * TTL, and unread ones past the much longer unread TTL (a year). See
 * `selectExpiredNotifications` in lib/notification-retention.ts, the
 * unit-tested statement of the same rule.
 *
 * In batches of DELETE_BATCH, each counted in SQL rather than returning every
 * deleted id to Node, and off notifications_created_idx (migration 083) rather
 * than a scan of the whole table.
 */
export async function cleanupReadNotifications(now = Date.now()): Promise<NotificationCleanupResult> {
  const db = getDb();
  if (!db) return { ok: false, deleted: 0, message: "The database is not connected." };

  const readCutoff = new Date(now - NOTIFICATION_TTL_MS).toISOString();
  const unreadCutoff = new Date(now - UNREAD_NOTIFICATION_TTL_MS).toISOString();
  const startedAt = Date.now();
  let deleted = 0;

  try {
    for (let batch = 0; batch < MAX_BATCHES && Date.now() - startedAt < RUN_BUDGET_MS; batch += 1) {
      const result = await db.execute(sql`
        with doomed as (
          select id from public.notifications
           where created_at < ${unreadCutoff}::timestamptz
              or (read_at is not null and created_at < ${readCutoff}::timestamptz)
           limit ${DELETE_BATCH}
        ), removed as (
          delete from public.notifications n using doomed where n.id = doomed.id returning 1
        )
        select count(*)::int as removed from removed`);
      const rows = (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as { removed?: unknown }[];
      const removed = Number(rows[0]?.removed ?? 0);
      deleted += removed;
      if (removed < DELETE_BATCH) break;
    }
    return { ok: true, deleted };
  } catch (error) {
    console.error("Notification cleanup failed", error);
    return { ok: false, deleted, message: "The cleanup could not run." };
  }
}
