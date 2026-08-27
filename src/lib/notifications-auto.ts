import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  getNotificationTemplate,
  SESSION_TEMPLATE_ID,
  WELCOME_TEMPLATE_ID,
} from "@/lib/data/notification-templates";

/**
 * Automatic delivery of the two fixed default templates.
 *
 * The admin Notifications screen has always described these as "auto-triggered
 * on first login", but nothing inserted a row, so every account's bell was
 * empty. These are the triggers.
 *
 * Every function here is best-effort: it is called from the middle of a login
 * or email-confirmation flow, and a notification that fails to insert must
 * never stop someone signing in. Failures are logged and swallowed.
 */

/** How long a session-verification notice suppresses the next one. */
const SESSION_DEDUP_MS = 60 * 60_000;

/**
 * Sends the welcome notification the first time it is needed for an account.
 *
 * Deduplicated on the `welcome` category, which only this dispatch produces —
 * the admin composer's audience categories are announcement/system/event/
 * security, and fixed templates cannot be dispatched by hand. That also makes
 * this safe to call on every login: accounts created before this existed pick
 * their welcome up once, and never again.
 */
export async function dispatchWelcomeNotification(userId: string): Promise<void> {
  const db = getDb();
  if (!db || !userId) return;
  try {
    const template = await getNotificationTemplate(WELCOME_TEMPLATE_ID);
    if (!template || !template.enabled) return;

    const [existing] = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.category, "welcome"),
        ),
      )
      .limit(1);
    if (existing) return;

    await db.insert(schema.notifications).values({
      userId,
      title: template.title,
      message: template.message,
      category: template.category,
      sender: template.sender,
      href: "/dashboard",
    });
  } catch (error) {
    console.error("Welcome notification dispatch failed", error);
  }
}

/**
 * Sends the session-verification notice after a successful sign-in.
 *
 * Deduplicated within a one-hour window so a rapid re-login (or an OAuth round
 * trip that lands back on the callback) does not flood the feed. `broadcastId
 * is null` keeps an admin's `security` broadcast from suppressing it.
 */
export async function dispatchSessionVerificationNotification(userId: string): Promise<void> {
  const db = getDb();
  if (!db || !userId) return;
  try {
    const template = await getNotificationTemplate(SESSION_TEMPLATE_ID);
    if (!template || !template.enabled) return;

    const cutoff = new Date(Date.now() - SESSION_DEDUP_MS);
    const [recent] = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.category, "security"),
          isNull(schema.notifications.broadcastId),
          gt(schema.notifications.createdAt, cutoff),
        ),
      )
      .limit(1);
    if (recent) return;

    await db.insert(schema.notifications).values({
      userId,
      title: template.title,
      message: template.message,
      category: template.category,
      sender: template.sender,
      href: "/dashboard/settings",
    });
  } catch (error) {
    console.error("Session verification notification dispatch failed", error);
  }
}

/**
 * Both fixed defaults for one successful sign-in. The welcome dispatch is
 * a no-op once the account already has one, so this is the single call every
 * auth entry point needs.
 */
export async function dispatchSignInNotifications(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  await Promise.all([
    dispatchWelcomeNotification(userId),
    dispatchSessionVerificationNotification(userId),
  ]);
}

/** Unread count for a user — used by server components that render the bell. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const db = getDb();
  if (!db || !userId) return 0;
  try {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
    return row?.total ?? 0;
  } catch {
    return 0;
  }
}
