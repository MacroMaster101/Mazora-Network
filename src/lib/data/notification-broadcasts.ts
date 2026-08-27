import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { NotificationAudience } from "@/lib/notification-targeting";

export type BroadcastPriority = "normal" | "important" | "urgent";

export interface NotificationBroadcast {
  id: string;
  title: string;
  message: string;
  audience: NotificationAudience;
  category: string;
  sender: string;
  priority: BroadcastPriority;
  href?: string;
  delivered: number;
  actorName: string | null;
  createdAt: string;
}

type BroadcastRow = typeof schema.notificationBroadcasts.$inferSelect;

function toBroadcast(row: BroadcastRow): NotificationBroadcast {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    audience: row.audience as NotificationAudience,
    category: row.category,
    sender: row.sender,
    priority: row.priority as BroadcastPriority,
    href: row.href ?? undefined,
    delivered: row.delivered,
    actorName: row.actorName,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Broadcast history, newest first. Returns an empty list rather than throwing
 * when the table is missing, so the admin screen still renders before
 * migration 037 is applied.
 */
export async function listNotificationBroadcasts(limit = 50): Promise<NotificationBroadcast[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.notificationBroadcasts)
      .orderBy(desc(schema.notificationBroadcasts.createdAt))
      .limit(limit);
    return rows.map(toBroadcast);
  } catch (error) {
    console.error("Broadcast history list failed", error);
    return [];
  }
}

export async function getNotificationBroadcast(id: string): Promise<NotificationBroadcast | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.notificationBroadcasts)
    .where(eq(schema.notificationBroadcasts.id, id))
    .limit(1);
  return row ? toBroadcast(row) : null;
}
