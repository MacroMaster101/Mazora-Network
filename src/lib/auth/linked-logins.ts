import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { claimOnce } from "@/lib/rate-limit";
import { endAllSessions } from "@/lib/data/account-status";
import { recordAudit } from "@/lib/audit-log";
import { notifyLinkedLoginRemoved } from "@/lib/security-alerts";
import {
  LINK_PENDING_MS,
  pendingLinkToTrust,
  reviewLinkedLogins,
  type LinkedLoginUser,
} from "@/lib/auth/linked-logins-core";

/**
 * Keeps an account's Google and Discord logins to the ones the site trusts
 * (the rules are in linked-logins-core). Every write goes straight to
 * auth.users with a JSON merge, as removeAccountPassword does, so nothing read
 * earlier is written back over a change made since.
 */

type Account = LinkedLoginUser & { id: string };

/** How often a login that cannot be removed is reported to the audit log. */
const STUCK_REPORT_MS = 24 * 60 * 60_000;

/** The trusted list's ids as a JSON array, or [] when the stored value is not one. */
const TRUSTED = sql`case when jsonb_typeof(raw_app_meta_data -> 'trusted_identities') = 'array'
  then raw_app_meta_data -> 'trusted_identities' else '[]'::jsonb end`;

/** First sight of an account with no list: everything on it now is trusted. Never overwrites a list. */
async function writeBaseline(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.execute(sql`
    update auth.users u
    set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'trusted_identities',
      (select coalesce(jsonb_agg(i.id::text order by i.created_at), '[]'::jsonb)
         from auth.identities i
        where i.user_id = u.id and i.provider not in ('email', 'phone')))
    where u.id = ${userId}::uuid and (u.raw_app_meta_data -> 'trusted_identities') is null`);
}

/** Adds ids to the trusted list; `clearPending` also ends a link started on the site. */
async function addTrusted(userId: string, ids: string[], clearPending = false): Promise<void> {
  const db = getDb();
  if (!db || ids.length === 0) return;
  await db.execute(sql`
    update auth.users
    set raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'trusted_identities',
      (select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
         from jsonb_array_elements_text(${TRUSTED} || ${JSON.stringify(ids)}::jsonb))))
      ${clearPending ? sql`- 'link_pending'` : sql``}
    where id = ${userId}::uuid`);
}

/**
 * A removed login's queued "login connected" alert would tell the owner to
 * remove something already gone; the removal notice replaces it. Only a nicety,
 * so a failure here must not stop the removal from ending the sessions.
 */
async function closeQueuedAlerts(userId: string, ids: string[]): Promise<void> {
  const db = getDb();
  if (!db || ids.length === 0) return;
  try {
    await db.execute(sql`
      update public.security_alerts
      set sent_at = now()
      where user_id = ${userId}::uuid
        and sent_at is null
        and source_id::text in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))`);
  } catch (error) {
    console.error("A removed login's queued alert could not be closed", error);
  }
}

/**
 * Removes the logins and signs the account out everywhere. Never the account's
 * last way in, and never its email or phone. Returns the providers removed.
 */
async function removeLogins(userId: string, ids: string[]): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const removed = (await db.execute(sql`
    delete from auth.identities i
    where i.user_id = ${userId}::uuid
      and i.id::text in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))
      and i.provider not in ('email', 'phone')
      and exists (select 1 from auth.identities o
                   where o.user_id = i.user_id
                     and o.id::text not in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)))
    returning i.id, i.provider`)) as unknown as Array<{ id: string; provider: string }>;
  await closeQueuedAlerts(userId, (removed ?? []).map((row) => row.id));
  // Keep app_metadata.providers as the auth server would after an unlink.
  await db.execute(sql`
    update auth.users u
    set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'providers',
      (select coalesce(jsonb_agg(distinct i.provider), '[]'::jsonb) from auth.identities i where i.user_id = u.id))
    where u.id = ${userId}::uuid`);
  return [...new Set((removed ?? []).map((row) => row.provider))];
}

/**
 * Checks the account's provider logins on every request (getAuthState) and in
 * the OAuth callback. "removed" means a login nobody added through the site
 * was on the account: it has been taken off, every session ended and the owner
 * told, and this request must not count as signed in. Errors leave the
 * session alone; the next request tries again.
 */
export async function checkLinkedLogins(user: Account): Promise<"ok" | "removed"> {
  const review = reviewLinkedLogins(user, Date.now());
  try {
    if (review.baseline) {
      await writeBaseline(user.id);
      return "ok";
    }
    if (review.trust.length) await addTrusted(user.id, review.trust);
    if (review.remove.length === 0) return "ok";
  } catch (error) {
    console.error("Linked logins could not be checked", error);
    return "ok";
  }

  // Refused from here on, whether or not this request is the one that cleans up.
  // The claim keeps concurrent requests from telling the owner twice. With the
  // shared store down the removal still runs (it is safe to repeat), and only
  // a request that actually removed something reports it.
  const claim = await claimOnce(`linked-login-removal:${user.id}`, 60_000);
  if (claim !== "duplicate") {
    try {
      const providers = await removeLogins(user.id, review.remove.map((login) => login.id));
      await endAllSessions(user.id);
      if (providers.length === 0) {
        // Another request removed it, or it is the account's only login, which
        // is never deleted. The session is still refused: a stolen session can
        // link a login and then unlink the owner's. Staff have to step in, so
        // this reports what is true, once a day, and sends no "we removed it".
        if (claim === "claimed" && (await claimOnce(`linked-login-stuck:${user.id}`, STUCK_REPORT_MS)) === "claimed") {
          console.error("An unrecognised login is the account's only login and could not be removed");
          await recordAudit({
            action: "auth.linked_login_stuck",
            actorId: user.id,
            by: "system",
            targetType: "user",
            targetId: user.id,
            metadata: { providers: review.remove.map((login) => login.provider) },
          });
        }
        return "removed";
      }
      await recordAudit({
        action: "auth.linked_login_removed",
        actorId: user.id,
        by: "system",
        targetType: "user",
        targetId: user.id,
        metadata: { providers },
      });
      await notifyLinkedLoginRemoved(user.id, providers);
    } catch (error) {
      console.error("An unrecognised linked login could not be removed", error);
    }
  }
  return "removed";
}

/** oauthAction, just before sending the member to link a provider. */
export async function markLinkPending(userId: string, provider: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.execute(sql`
      update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'link_pending', jsonb_build_object('provider', ${provider}::text, 'until', ${Date.now() + LINK_PENDING_MS}::bigint))
      where id = ${userId}::uuid`);
    return true;
  } catch (error) {
    console.error("A pending link could not be recorded", error);
    return false;
  }
}

/** The callback, once the link comes back: trust the login it added and end the pending link. */
export async function settlePendingLink(user: Account): Promise<void> {
  const id = pendingLinkToTrust(user, Date.now());
  if (!id) return;
  try {
    await addTrusted(user.id, [id], true);
    // Seen by the check that follows in the same request.
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const trusted = Array.isArray(meta.trusted_identities) ? meta.trusted_identities : [];
    user.app_metadata = { ...meta, trusted_identities: [...trusted, id] };
  } catch (error) {
    console.error("The new linked login could not be trusted", error);
  }
}
