"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, NOTIFICATIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { listAccounts } from "@/lib/data/accounts";
import type { BroadcastPriority } from "@/lib/data/notification-broadcasts";
import { updateNotificationTemplate } from "@/lib/data/notification-templates";
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
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
});

const directSchema = contentSchema.extend({ userId: z.string().uuid() });

const broadcastEditSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  message: z.string().trim().min(1).max(2000),
  audience: z.enum(["all", "staff", "moderators", "users"]),
  priority: z.enum(["normal", "important", "urgent"]),
  category: z.enum(["welcome", "system", "support", "security", "announcement", "event"]),
});

const templateEditSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(140),
  message: z.string().trim().min(1).max(2000),
});

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
  revalidatePath("/admin/notifications");
  // The dashboard overview renders an unread count, so it goes stale too.
  revalidatePath("/dashboard");
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
  priority?: BroadcastPriority;
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
    // The broadcast record is written first so every delivered row can point
    // back at it. That link is what makes editing a sent broadcast rewrite
    // what recipients see, and deleting one withdraw the delivered copies.
    const [broadcast] = await db
      .insert(schema.notificationBroadcasts)
      .values({
        title: parsed.data.title,
        message: parsed.data.message,
        audience: parsed.data.audience,
        category: parsed.data.category,
        sender: parsed.data.sender,
        priority: parsed.data.priority,
        href: parsed.data.href || null,
        delivered: recipients.length,
        actorId: auth.actorId,
        actorName: auth.session.username,
      })
      .returning();

    await db.insert(schema.notifications).values(recipients.map((account) => ({
      userId: account.userId,
      title: parsed.data.title,
      message: parsed.data.message,
      category: parsed.data.category,
      sender: parsed.data.sender,
      href: parsed.data.href || null,
      broadcastId: broadcast?.id ?? null,
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
    return { ok: false, message: "Delivery failed. Make sure migrations 036 and 037 have been applied." };
  }
}

/**
 * Rewrites a sent broadcast and every notification it delivered, so correcting
 * a typo reaches the recipients who already have it rather than only the
 * admin's own history list.
 *
 * The audience is stored for the record but deliberately not re-fanned-out:
 * re-delivering to a wider audience is a new broadcast, not an edit.
 */
export async function updateBroadcastNotificationAction(input: {
  id: string;
  title: string;
  message: string;
  audience: NotificationAudience;
  priority: BroadcastPriority;
  category: NotificationCategory;
}): Promise<Result> {
  const auth = await authorizeAdmin();
  if (!auth) return { ok: false, message: "Not authorized." };
  const parsed = broadcastEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the broadcast title and message." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    const [updated] = await db
      .update(schema.notificationBroadcasts)
      .set({
        title: parsed.data.title,
        message: parsed.data.message,
        audience: parsed.data.audience,
        priority: parsed.data.priority,
        category: parsed.data.category,
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationBroadcasts.id, parsed.data.id))
      .returning();
    if (!updated) return { ok: false, message: "That broadcast no longer exists." };

    const delivered = await db
      .update(schema.notifications)
      .set({
        title: parsed.data.title,
        message: parsed.data.message,
        category: parsed.data.category,
      })
      .where(eq(schema.notifications.broadcastId, parsed.data.id))
      .returning({ id: schema.notifications.id });

    await db.insert(schema.auditLogs).values({
      actorId: auth.actorId,
      action: "notifications.broadcast.update",
      targetType: "broadcast",
      targetId: parsed.data.id,
      metadata: { title: parsed.data.title, updated: delivered.length, by: auth.session.username },
    });
    refreshNotificationPages();
    return {
      ok: true,
      message: `Broadcast updated across ${delivered.length} delivered notification${delivered.length === 1 ? "" : "s"}.`,
      delivered: delivered.length,
    };
  } catch (error) {
    console.error("Broadcast update failed", error);
    return { ok: false, message: "Update failed. Make sure migration 037 has been applied." };
  }
}

/**
 * Withdraws a broadcast. The `broadcast_id` foreign key cascades, so deleting
 * the record removes every copy still sitting in a recipient's feed.
 */
export async function deleteBroadcastNotificationAction(id: string): Promise<Result> {
  const auth = await authorizeAdmin();
  if (!auth) return { ok: false, message: "Not authorized." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid broadcast." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    const [removed] = await db
      .delete(schema.notificationBroadcasts)
      .where(eq(schema.notificationBroadcasts.id, id))
      .returning();
    if (!removed) return { ok: false, message: "That broadcast no longer exists." };
    await db.insert(schema.auditLogs).values({
      actorId: auth.actorId,
      action: "notifications.broadcast.delete",
      targetType: "broadcast",
      targetId: id,
      metadata: { title: removed.title, withdrawn: removed.delivered, by: auth.session.username },
    });
    refreshNotificationPages();
    return { ok: true, message: `Broadcast withdrawn from ${removed.delivered} account${removed.delivered === 1 ? "" : "s"}.` };
  } catch (error) {
    console.error("Broadcast delete failed", error);
    return { ok: false, message: "Delete failed. Make sure migration 037 has been applied." };
  }
}

/**
 * Saves a default template's text. Applies to fixed templates too — their text
 * is the one part that is meant to be editable, and the next auto-dispatch
 * reads it straight back out of this table.
 */
export async function updateNotificationTemplateAction(input: {
  id: string;
  title: string;
  message: string;
}): Promise<Result> {
  const auth = await authorizeAdmin();
  if (!auth) return { ok: false, message: "Not authorized." };
  const parsed = templateEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the template title and message." };
  try {
    const updated = await updateNotificationTemplate(parsed.data.id, {
      title: parsed.data.title,
      message: parsed.data.message,
    });
    if (!updated) return { ok: false, message: "That template no longer exists." };
    await getDb()?.insert(schema.auditLogs).values({
      actorId: auth.actorId,
      action: "notifications.template.update",
      targetType: "template",
      targetId: parsed.data.id,
      metadata: { title: parsed.data.title, by: auth.session.username },
    });
    refreshNotificationPages();
    return { ok: true, message: "Default template updated." };
  } catch (error) {
    console.error("Template update failed", error);
    return { ok: false, message: "Update failed. Make sure migration 037 has been applied." };
  }
}

/**
 * Enables or disables a template. A disabled fixed template stops firing from
 * the auth flows; a disabled dispatchable one is no longer offered in the
 * Direct User Dispatcher.
 */
export async function setNotificationTemplateEnabledAction(id: string, enabled: boolean): Promise<Result> {
  const auth = await authorizeAdmin();
  if (!auth) return { ok: false, message: "Not authorized." };
  if (!z.string().trim().min(1).max(64).safeParse(id).success) return { ok: false, message: "Invalid template." };
  try {
    const updated = await updateNotificationTemplate(id, { enabled });
    if (!updated) return { ok: false, message: "That template no longer exists." };
    await getDb()?.insert(schema.auditLogs).values({
      actorId: auth.actorId,
      action: "notifications.template.toggle",
      targetType: "template",
      targetId: id,
      metadata: { enabled, by: auth.session.username },
    });
    refreshNotificationPages();
    return { ok: true, message: enabled ? "Template enabled." : "Template disabled." };
  } catch (error) {
    console.error("Template toggle failed", error);
    return { ok: false, message: "Update failed. Make sure migration 037 has been applied." };
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
