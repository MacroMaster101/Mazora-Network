import "server-only";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  ALERT_COPY,
  alertLabel,
  buildEmailCodeSignInEmail,
  buildSecurityAlertEmail,
  isSecurityAlertKind,
  type SecurityAlertItem,
} from "@/lib/email/security-alert-email";
import { resolvePublicOrigin } from "@/lib/site";
import type { User } from "@supabase/supabase-js";
import { savedTimeZone } from "@/lib/time-zone";

/**
 * Tells a member when a passkey, authenticator app, security key or phone is
 * added to their account, and when an email code finishes a sign-in: a
 * notification in the bell and an email.
 *
 * Migration 079 queues the alerts from triggers on Supabase's own tables, so a
 * method added straight through Supabase's API (with a stolen session, say)
 * is queued exactly like one added on the site. This sends the queue:
 *
 *   - right after the site's own add-a-passkey and set-up-2FA actions;
 *   - on every sign-in (dispatchSignInNotifications), which catches anything
 *     added elsewhere before it is first used here;
 *   - daily from /api/cron/security-alerts, for whatever is left.
 *
 * Each row is claimed (sent_at) before anything is sent, with SKIP LOCKED, so
 * two of those running at once cannot both send it. The cost is that a failed
 * email is not retried; the notification is written first and still lands.
 * Best-effort throughout: it runs beside sign-ins and must never fail one.
 */

const BATCH = 100;
/** Sent rows are kept a while for reference, then removed by the daily job. */
const KEEP_SENT_DAYS = 90;

type ClaimedRow = {
  id: string;
  user_id: string;
  kind: string;
  label: string | null;
  created_at: Date | string;
};

/** Send pending alerts, for one account or (from the cron) everyone's. */
export async function deliverSecurityAlerts(userId?: string): Promise<{ ok: boolean; sent: number }> {
  const db = getDb();
  if (!db) return { ok: false, sent: 0 };

  let rows: ClaimedRow[];
  try {
    rows = (await db.execute(sql`
      update public.security_alerts
      set sent_at = now()
      where id in (
        select id from public.security_alerts
        where sent_at is null ${userId ? sql`and user_id = ${userId}::uuid` : sql``}
        order by created_at
        limit ${BATCH}
        for update skip locked
      )
      returning
        id,
        user_id,
        kind,
        -- Its name now, not when it was queued: the site renames a new passkey
        -- right after Supabase saves it. Falls back once it has been removed.
        coalesce(
          case when kind = 'passkey'
            then (select w.friendly_name from auth.webauthn_credentials w where w.id = source_id)
            else (select f.friendly_name from auth.mfa_factors f where f.id = source_id)
          end,
          label
        ) as label,
        created_at
    `)) as unknown as ClaimedRow[];
  } catch (error) {
    // Most likely migration 079 is not applied yet.
    console.error("Security alerts could not be claimed", error);
    return { ok: false, sent: 0 };
  }

  const byUser = new Map<string, SecurityAlertItem[]>();
  for (const row of rows ?? []) {
    if (!isSecurityAlertKind(row.kind)) continue;
    const items = byUser.get(row.user_id) ?? [];
    items.push({ kind: row.kind, label: row.label, at: new Date(row.created_at) });
    byUser.set(row.user_id, items);
  }

  for (const [owner, items] of byUser) {
    items.sort((a, b) => a.at.getTime() - b.at.getTime());
    await notifyOwner(owner, items);
  }
  return { ok: true, sent: rows?.length ?? 0 };
}

/** Run the delivery after the response, so it never slows the action that queued it. */
export function scheduleSecurityAlerts(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    after(() => deliverSecurityAlerts(userId).then(() => undefined));
  } catch {
    // Outside a request (scripts, tests): just start it.
    void deliverSecurityAlerts(userId);
  }
}

/** Remove alerts sent long ago. Called by the daily job. */
export async function pruneSentSecurityAlerts(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const removed = (await db.execute(sql`
      delete from public.security_alerts
      where sent_at < now() - make_interval(days => ${KEEP_SENT_DAYS})
      returning id
    `)) as unknown as Array<{ id: string }>;
    return removed?.length ?? 0;
  } catch (error) {
    console.error("Old security alerts could not be removed", error);
    return 0;
  }
}

/** The name to greet the member by, from whatever their sign-in provider gave. */
function displayNameOf(meta: Record<string, unknown> | undefined): string | null {
  const m = meta ?? {};
  return (
    (typeof m.display_name === "string" && m.display_name) ||
    (typeof m.full_name === "string" && m.full_name) ||
    (typeof m.name === "string" && m.name) ||
    null
  );
}

/**
 * An email code just finished a sign-in: a notification in the bell and an
 * email, after the response so the sign-in is never slowed or failed by it.
 */
export function scheduleEmailCodeSignInAlert(user: Pick<User, "id" | "email" | "user_metadata">): void {
  const at = new Date();
  const run = () => notifyEmailCodeSignIn(user, at);
  try {
    after(run);
  } catch {
    void run();
  }
}

async function notifyEmailCodeSignIn(user: Pick<User, "id" | "email" | "user_metadata">, at: Date): Promise<void> {
  const db = getDb();
  if (db) {
    try {
      await db.insert(schema.notifications).values({
        userId: user.id,
        title: "Signed in with an email code",
        message: "An email code was used to finish signing in. If this wasn't you, change your password and turn off email codes in Settings.",
        category: "security",
        href: "/dashboard/settings#two-step",
      });
    } catch (error) {
      console.error("Email-code sign-in notification failed", error);
    }
  }

  if (!user.email) return;
  try {
    const mail = buildEmailCodeSignInEmail({
      name: displayNameOf(user.user_metadata),
      origin: resolvePublicOrigin(),
      at,
      timeZone: savedTimeZone(user.user_metadata),
    });
    await sendEmail({ to: user.email, ...mail });
  } catch (error) {
    console.error("Email-code sign-in alert email failed", error);
  }
}

async function notifyOwner(userId: string, items: SecurityAlertItem[]): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.insert(schema.notifications).values(
      items.map((item) => {
        const label = alertLabel(item.label);
        const what = label ? `"${label}"` : ALERT_COPY[item.kind].noun;
        return {
          userId,
          title: ALERT_COPY[item.kind].title,
          message: `${what} was added to your account. If this wasn't you, remove it in Settings and change your password.`,
          category: "security",
          href: item.kind === "passkey" ? "/dashboard/settings#passkeys" : "/dashboard/settings",
        };
      }),
    );
  } catch (error) {
    console.error("Security alert notification failed", error);
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (error || !email) return;

    const name = displayNameOf(data.user.user_metadata);
    const timeZone = savedTimeZone(data.user.user_metadata);
    await sendEmail({ to: email, ...buildSecurityAlertEmail({ name, origin: resolvePublicOrigin(), items, timeZone }) });
  } catch (error) {
    console.error("Security alert email failed", error);
  }
}
