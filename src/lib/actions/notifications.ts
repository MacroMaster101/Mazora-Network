"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, NOTIFICATIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { findAccountName, listAccountRoles } from "@/lib/data/accounts";
import type { BroadcastPriority } from "@/lib/data/notification-broadcasts";
import { getNotificationTemplate, updateNotificationTemplate } from "@/lib/data/notification-templates";
import { getDb, schema } from "@/lib/db/client";
import { reportDatabaseReadFailure } from "@/lib/db/errors";
import {
  roleMatchesNotificationAudience,
  type NotificationAudience,
} from "@/lib/notification-targeting";
import { isSafeLink } from "@/lib/net/safe-url";
import { uuidArrayLiteral } from "@/lib/validation/id";
import {
  canSendOfficialNotifications,
  officialNotificationRefusal,
  officialTemplateRefusal,
} from "@/lib/notification-authority";
import { accountKey, rateLimitShared } from "@/lib/rate-limit";
import type { Role } from "@/lib/types";

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
  // A site path or an https link; never javascript: or data:.
  href: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || isSafeLink(value), "Link must be a site path like /news or an https:// URL.")
    .optional(),
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

const templateIdSchema = z.string().trim().min(1).max(64);

const templateEditSchema = z.object({
  id: templateIdSchema,
  title: z.string().trim().min(1).max(140),
  message: z.string().trim().min(1).max(2000),
});

const templateToggleSchema = z.object({ id: templateIdSchema, enabled: z.boolean() });

/**
 * Why this actor may not change the stored template, or null when they may.
 * Only read below Owner, the same way the broadcast edit reads the stored row.
 */
async function storedTemplateRefusal(role: Role, id: string): Promise<string | null> {
  if (canSendOfficialNotifications(role)) return null;
  const stored = await getNotificationTemplate(id);
  if (!stored) return "That template no longer exists.";
  return officialTemplateRefusal(role, stored);
}

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

/**
 * The signed-in member's id, only for an active session. getSession carries the
 * confirmed-email and active-profile checks that the bare session id skips.
 */
async function activeUserId(): Promise<string | null> {
  const session = await getSession();
  return session ? getSessionUserId() : null;
}

export async function listMyNotificationsAction(): Promise<AccountNotification[]> {
  const [userId, db] = await Promise.all([activeUserId(), Promise.resolve(getDb())]);
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
    reportDatabaseReadFailure("Notification list failed", error);
    return [];
  }
}

export async function setNotificationReadAction(id: string, read: boolean): Promise<Result> {
  const userId = await activeUserId();
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
  const userId = await activeUserId();
  const db = getDb();
  if (!userId) return { ok: false, message: "Your session has expired." };
  if (!db) return { ok: false, message: "The database is not connected." };
  await db.update(schema.notifications).set({ readAt: read ? new Date() : null }).where(eq(schema.notifications.userId, userId));
  refreshNotificationPages();
  return { ok: true, message: read ? "All notifications marked as read." : "All notifications marked as unread." };
}

export async function deleteNotificationAction(id?: string): Promise<Result> {
  const userId = await activeUserId();
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
  const refusal = officialNotificationRefusal(auth.session.role, parsed.data);
  if (refusal) return { ok: false, message: refusal };
  const limit = await rateLimitShared(accountKey("notification-broadcast", auth.actorId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many broadcasts. Wait a moment and try again." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const accounts = await listAccountRoles();
  if (!accounts) return { ok: false, message: "Accounts could not be loaded." };
  const recipients = accounts.filter((account) => roleMatchesNotificationAudience(account.role, parsed.data.audience));
  if (recipients.length === 0) return { ok: false, message: "No accounts match that audience." };
  try {
    // One transaction: a delivery that fails part-way leaves no broadcast
    // record claiming it reached people who never got it.
    await db.transaction(async (tx) => {
      // The broadcast record is written first so every delivered row can point
      // back at it. That link is what makes editing a sent broadcast rewrite
      // what recipients see, and deleting one withdraw the delivered copies.
      const [broadcast] = await tx
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

      // The recipients travel as ONE array parameter. A multi-row VALUES list
      // takes seven parameters per recipient and Postgres allows 65,535, so
      // the old insert failed outright past about 9,000 members.
      await tx.execute(sql`
        insert into public.notifications (user_id, title, message, category, sender, href, broadcast_id)
        select recipient, ${parsed.data.title}, ${parsed.data.message}, ${parsed.data.category},
               ${parsed.data.sender}, ${parsed.data.href || null}, ${broadcast?.id ?? null}::uuid
          from unnest(${uuidArrayLiteral(recipients.map((account) => account.userId))}::uuid[]) as recipient`);
      await tx.insert(schema.auditLogs).values({
        actorId: auth.actorId,
        action: "notifications.broadcast",
        targetType: "audience",
        targetId: parsed.data.audience,
        metadata: { delivered: recipients.length, title: parsed.data.title, by: auth.session.username },
      });
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
  const refusal = officialNotificationRefusal(auth.session.role, { category: parsed.data.category });
  if (refusal) return { ok: false, message: refusal };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    // Rewriting an owner's official broadcast would put new words under the
    // Mazora Team identity, so below Owner only staff-sent ones can be edited.
    if (!canSendOfficialNotifications(auth.session.role)) {
      const [existing] = await db
        .select({ sender: schema.notificationBroadcasts.sender, category: schema.notificationBroadcasts.category })
        .from(schema.notificationBroadcasts)
        .where(eq(schema.notificationBroadcasts.id, parsed.data.id))
        .limit(1);
      if (!existing) return { ok: false, message: "That broadcast no longer exists." };
      if (officialNotificationRefusal(auth.session.role, existing)) {
        return { ok: false, message: "Only owners can edit a broadcast sent as the Mazora Team or as a security notice." };
      }
    }
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
    // Withdrawing an owner's official broadcast is as much an act of the
    // Mazora Team identity as rewriting it, so the edit rule applies here too.
    if (!canSendOfficialNotifications(auth.session.role)) {
      const [existing] = await db
        .select({ sender: schema.notificationBroadcasts.sender, category: schema.notificationBroadcasts.category })
        .from(schema.notificationBroadcasts)
        .where(eq(schema.notificationBroadcasts.id, id))
        .limit(1);
      if (!existing) return { ok: false, message: "That broadcast no longer exists." };
      if (officialNotificationRefusal(auth.session.role, existing)) {
        return { ok: false, message: "Only owners can withdraw a broadcast sent as the Mazora Team or as a security notice." };
      }
    }
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
    // Only the text is editable here, so a template cannot be turned official
    // through this action; the stored sender and category are what decide.
    const refusal = await storedTemplateRefusal(auth.session.role, parsed.data.id);
    if (refusal) return { ok: false, message: refusal };
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
  const parsed = templateToggleSchema.safeParse({ id, enabled });
  if (!parsed.success) return { ok: false, message: "Invalid template." };
  try {
    // Switching the Session Verification notice off is as consequential as
    // rewriting it: unrecognised-device logins would stop being reported.
    const refusal = await storedTemplateRefusal(auth.session.role, parsed.data.id);
    if (refusal) return { ok: false, message: refusal };
    const updated = await updateNotificationTemplate(parsed.data.id, { enabled: parsed.data.enabled });
    if (!updated) return { ok: false, message: "That template no longer exists." };
    await getDb()?.insert(schema.auditLogs).values({
      actorId: auth.actorId,
      action: "notifications.template.toggle",
      targetType: "template",
      targetId: parsed.data.id,
      metadata: { enabled: parsed.data.enabled, by: auth.session.username },
    });
    refreshNotificationPages();
    return { ok: true, message: parsed.data.enabled ? "Template enabled." : "Template disabled." };
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
  const refusal = officialNotificationRefusal(auth.session.role, parsed.data);
  if (refusal) return { ok: false, message: refusal };
  const limit = await rateLimitShared(accountKey("notification-direct", auth.actorId), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many notifications. Wait a moment and try again." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const recipient = await findAccountName(parsed.data.userId);
  if (recipient === undefined) return { ok: false, message: "Accounts could not be loaded." };
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
