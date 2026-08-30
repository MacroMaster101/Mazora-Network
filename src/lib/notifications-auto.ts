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
 * Whether this sign-in looks unrecognised for this account.
 *
 * Supabase records `user_agent` and `ip` on every row in `auth.sessions`, so
 * the account's own history is the fingerprint store — nothing new to persist.
 * The newest session is the one that was just created by this login; if any
 * OLDER session carries the same user agent, the account has signed in from
 * this browser/device before and there is nothing to tell the member.
 *
 * KNOWN LIMIT IN THIS DEPLOYMENT, measured rather than assumed: Supabase auth
 * is called from the Next.js server, so Supabase records the SERVER as the
 * client. Across all 27 sessions in this project, zero carry a browser user
 * agent — they read "Vercel Edge Functions", "Next.js Middleware" or "node" —
 * and the `ip` column holds the Vercel function's address (13.x/18.x/54.x),
 * not the member's.
 *
 * So this cannot currently distinguish one member device from another. What it
 * does in practice is fire once per account, on the first sign-in, and stay
 * silent afterwards, because every later session reports the same server user
 * agent. That is a large improvement on a notice per login and it is the
 * behaviour the bell now has — but it is NOT true new-device detection, and
 * this comment exists so nobody later reads the function name and believes it
 * is.
 *
 * Making it real needs the browser's own user agent, which the Next.js server
 * CAN see via `headers()` at login, hashed and stored per account. That is a
 * table this project does not have yet.
 *
 * Keyed on `user_agent` and NOT on `ip` regardless: the ip column rotates per
 * function invocation (24 distinct IPs across 27 sessions), so an IP-keyed
 * rule would fire on nearly every login — worse than the noise it replaced.
 *
 * Fails toward notifying. If the history cannot be read, or the session has no
 * user agent to compare, the member gets the notice: a spurious "new device"
 * message is a far cheaper mistake than staying silent about a real one.
 */
async function isUnrecognisedSession(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return true;
  try {
    const rows = (await db.execute(
      sql`select user_agent from auth.sessions where user_id = ${userId}::uuid order by created_at desc limit 50`,
    )) as unknown as Array<{ user_agent: string | null }>;

    const [current, ...previous] = rows ?? [];
    if (!current?.user_agent) return true;
    return !previous.some((row) => row.user_agent === current.user_agent);
  } catch (error) {
    console.error("New-device check failed", error);
    return true;
  }
}

/**
 * Sends the session-verification notice after a successful sign-in.
 *
 * Only fires when the sign-in comes from a device the account has not used
 * before — which is what this template's own trigger note always promised
 * ("first login or new device session") and what the code did not previously
 * do. Sent on every login it was noise: a member signing in daily accumulated
 * a notice a day saying nothing actionable, which trains people to ignore the
 * bell that also carries the notices that matter.
 *
 * Still deduplicated within a one-hour window as a backstop, so a rapid
 * re-login (or an OAuth round trip that lands back on the callback) cannot
 * double-send even if the user agent varies between the two hops.
 * `broadcastId is null` keeps an admin's `security` broadcast from
 * suppressing it.
 */
export async function dispatchSessionVerificationNotification(userId: string): Promise<void> {
  const db = getDb();
  if (!db || !userId) return;
  try {
    const template = await getNotificationTemplate(SESSION_TEMPLATE_ID);
    if (!template || !template.enabled) return;

    // A device this account has used before is not news; say nothing.
    if (!(await isUnrecognisedSession(userId))) return;

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

/**
 * Tells the right person that someone replied: the suggestion's author for a
 * top-level reply, or the specific person answered (the parent reply's
 * author) for a nested reply — the `context` field picks the wording so a
 * nested-reply recipient isn't told they got a reply "to your suggestion"
 * when the suggestion may belong to someone else entirely. Best-effort like
 * every dispatch here: a notification failure must never fail the reply
 * itself. Replying to your own suggestion or your own reply notifies nobody.
 */
export async function dispatchSuggestionReplyNotification(input: {
  authorId: string; replierId: string; suggestionId: string;
  suggestionTitle: string; replierName: string; context: "suggestion" | "reply";
}): Promise<void> {
  const db = getDb();
  if (!db || !input.authorId || input.authorId === input.replierId) return;
  const isNested = input.context === "reply";
  try {
    await db.insert(schema.notifications).values({
      userId: input.authorId,
      title: isNested ? "💬 New reply to your comment" : "💬 New reply to your suggestion",
      message: isNested
        ? `${input.replierName} replied to your comment on "${input.suggestionTitle}".`
        : `${input.replierName} replied to "${input.suggestionTitle}".`,
      category: "support",
      sender: "mazora",
      href: `/support/suggestions/${input.suggestionId}`,
    });
  } catch (error) {
    console.error("Suggestion reply notification dispatch failed", error);
  }
}
