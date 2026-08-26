"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, NOTIFICATIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { listAccounts } from "@/lib/data/accounts";
import { getDb, schema } from "@/lib/db/client";
import {
  roleMatchesNotificationAudience,
  type NotificationAudience,
} from "@/lib/notification-targeting";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";

export type NotificationCategory = "welcome" | "system" | "support" | "security" | "announcement" | "event";
export type NotificationSender = "mazora" | "staff" | "system";

export interface AccountNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  sender: NotificationSender;
  href?: string;
  read: boolean;
  createdAt: string;
}

type Result = { ok: true; message: string; delivered?: number } | { ok: false; message: string };

const contentSchema = z.object({
  title: z.string().trim().min(1).max(140),
  message: z.string().trim().min(1).max(2000),
  category: z.enum(["welcome", "system", "support", "security", "announcement", "event"]),
  sender: z.enum(["mazora", "staff", "system"]),
  href: z.string().trim().max(500).optional(),
});

const broadcastSchema = contentSchema.extend({
  audience: z.enum(["all", "staff", "moderators", "users"]),
});

const directSchema = contentSchema.extend({ userId: z.string().uuid() });

async function authorizeAdmin() {
  const [session, actorId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !actorId) return null;
  return (await canManageModule(NOTIFICATIONS_PERMISSION_KEY, session, actorId))
    ? { session, actorId }
    : null;
}

function refreshNotificationPages() {
  revalidatePath("/dashboard/notifications");
  revalidatePath("/admin/account/notifications");
}

export async function listMyNotificationsAction(): Promise<AccountNotification[]> {
  const [userId, db] = await Promise.all([getSessionUserId(), Promise.resolve(getDb())]);
  if (!userId || !db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(100);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      category: row.category as NotificationCategory,
      sender: row.sender as NotificationSender,
      href: row.href ?? undefined,
      read: Boolean(row.readAt),
      createdAt: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("Notification list failed", error);
    return [];
  }
}

export async function setNotificationReadAction(id: string, read: boolean): Promise<Result> {
  const userId = await getSessionUserId();
  const db = getDb();
  if (!userId) return { ok: false, message: "Your session has expired." };
  if (!db) return { ok: false, message: "The database is not connected." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid notification." };
  await db.update(schema.notifications).set({ readAt: read ? new Date() : null }).where(
    and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId)),
  );
  refreshNotificationPages();
  return { ok: true, message: read ? "Marked as read." : "Marked as unread." };
}

export async function setAllNotificationsReadAction(read: boolean): Promise<Result> {
  const userId = await getSessionUserId();
  const db = getDb();
  if (!userId) return { ok: false, message: "Your session has expired." };
  if (!db) return { ok: false, message: "The database is not connected." };
  await db.update(schema.notifications).set({ readAt: read ? new Date() : null }).where(eq(schema.notifications.userId, userId));
  refreshNotificationPages();
  return { ok: true, message: read ? "All notifications marked as read." : "All notifications marked as unread." };
}

export async function deleteNotificationAction(id?: string): Promise<Result> {
  const userId = await getSessionUserId();
  const db = getDb();
  if (!userId) return { ok: false, message: "Your session has expired." };
  if (!db) return { ok: false, message: "The database is not connected." };
  if (id && !z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid notification." };
  const condition = id
    ? and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId))
    : eq(schema.notifications.userId, userId);
  await db.delete(schema.notifications).where(condition);
  refreshNotificationPages();
  return { ok: true, message: id ? "Notification deleted." : "Notifications cleared." };
}

export async function sendBroadcastNotificationAction(input: {
  title: string;
  message: string;
  audience: NotificationAudience;
  category: NotificationCategory;
  sender: NotificationSender;
  href?: string;
}): Promise<Result> {
  const auth = await authorizeAdmin();
  if (!auth) return { ok: false, message: "Not authorized." };
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the notification title, message, and audience." };
  const limit = await rateLimitShared(await actionClientKey("notification-broadcast", auth.actorId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many broadcasts. Wait a moment and try again." };
  const db = getDb();
  const accounts = await listAccounts();
  if (!db) return { ok: false, message: "The database is not connected." };
  if (!accounts) return { ok: false, message: "Accounts could not be loaded." };
  const recipients = accounts.filter((account) => roleMatchesNotificationAudience(account.role, parsed.data.audience));
  if (recipients.length === 0) return { ok: false, message: "No accounts match that audience." };
  try {
    await db.insert(schema.notifications).values(recipients.map((account) => ({
      userId: account.userId,
      title: parsed.data.title,
      message: parsed.data.message,
      category: parsed.data.category,
      sender: parsed.data.sender,
      href: parsed.data.href || null,
    })));
    await db.insert(schema.auditLogs).values({
      actorId: auth.actorId,
      action: "notifications.broadcast",
      targetType: "audience",
      targetId: parsed.data.audience,
      metadata: { delivered: recipients.length, title: parsed.data.title, by: auth.session.username },
    });
    refreshNotificationPages();
    return { ok: true, message: `Delivered to ${recipients.length} account${recipients.length === 1 ? "" : "s"}.`, delivered: recipients.length };
  } catch (error) {
    console.error("Notification broadcast failed", error);
    return { ok: false, message: "Delivery failed. Make sure migration 036 has been applied." };
  }
}

export async function sendDirectNotificationAction(input: {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  sender: NotificationSender;
  href?: string;
}): Promise<Result> {
  const auth = await authorizeAdmin();
  if (!auth) return { ok: false, message: "Not authorized." };
  const parsed = directSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the selected account, title, and message." };
  const limit = await rateLimitShared(await actionClientKey("notification-direct", auth.actorId), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many notifications. Wait a moment and try again." };
  const db = getDb();
  const accounts = await listAccounts();
  if (!db) return { ok: false, message: "The database is not connected." };
  const recipient = accounts?.find((account) => account.userId === parsed.data.userId);
  if (!recipient) return { ok: false, message: "That account no longer exists." };
  try {
    await db.insert(schema.notifications).values({
      userId: recipient.userId,
      title: parsed.data.title,
      message: parsed.data.message,
      category: parsed.data.category,
      sender: parsed.data.sender,
      href: parsed.data.href || null,
    });
    await db.insert(schema.auditLogs).values({
      actorId: auth.actorId,
      action: "notifications.direct",
      targetType: "user",
      targetId: recipient.userId,
      metadata: { title: parsed.data.title, username: recipient.username, by: auth.session.username },
    });
    refreshNotificationPages();
    return { ok: true, message: `Delivered to ${recipient.username}.`, delivered: 1 };
  } catch (error) {
    console.error("Direct notification failed", error);
    return { ok: false, message: "Delivery failed. Make sure migration 036 has been applied." };
  }
}
