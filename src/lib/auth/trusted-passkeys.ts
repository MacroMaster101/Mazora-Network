import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { claimOnce } from "@/lib/rate-limit";
import { endAllSessions } from "@/lib/data/account-status";
import { recordAudit } from "@/lib/audit-log";
import { notifyLinkedLoginRemoved } from "@/lib/security-alerts";
import { PASSKEY_PENDING_MS, parsePasskeyState, reviewPasskeys, type PasskeyState } from "@/lib/auth/trusted-passkeys-core";

/**
 * Keeps an account's passkeys to the ones the site trusts (the rules are in
 * trusted-passkeys-core). Every write goes straight to auth.users with a JSON
 * merge, as linked-logins does, so nothing read earlier is written back over a
 * change made since.
 *
 * Removing a member's own passkey would be worse than the gap this closes, so:
 * a read that fails, or comes back in a shape that was not asked for, decides
 * nothing; the list, the add in progress and the passkeys are read in one
 * statement, so they are never from different moments; and the delete checks
 * the list and the add in progress again itself, in the same statement.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Every passkey on the account now, as a JSON array of ids. Needs auth.users as `u`. */
const CURRENT = sql`(select coalesce(jsonb_agg(w.id::text), '[]'::jsonb)
  from auth.webauthn_credentials w where w.user_id = u.id)`;

/** Whether the account has a trusted list at all. Needs auth.users as `u`. */
const HAS_LIST = sql`jsonb_typeof(u.raw_app_meta_data -> 'trusted_passkeys') = 'array'`;

/** The database's clock in milliseconds: the one clock `passkey_pending` is written and read with. */
const NOW_MS = sql`floor(extract(epoch from now()) * 1000)`;

/** The account's list, add in progress and passkeys at one moment. Null when it cannot be known. */
async function readPasskeyState(userId: string): Promise<PasskeyState | null> {
  const db = getDb();
  if (!db) return null;
  const rows = (await db.execute(sql`
    select u.raw_app_meta_data -> 'trusted_passkeys' as trusted,
           u.raw_app_meta_data -> 'passkey_pending' as pending,
           ${CURRENT} as passkeys,
           ${NOW_MS}::float8 as now
    from auth.users u
    where u.id = ${userId}::uuid`)) as unknown as unknown[];
  return parsePasskeyState(rows?.[0]);
}

/** First sight of an account with no list: every passkey on it now is trusted. Never overwrites a list. */
async function writeBaseline(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.execute(sql`
    update auth.users u
    set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('trusted_passkeys', ${CURRENT})
    where u.id = ${userId}::uuid and (u.raw_app_meta_data -> 'trusted_passkeys') is null`);
}

/**
 * A removed passkey's queued "passkey added" alert would tell the owner to
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
    console.error("A removed passkey's queued alert could not be closed", error);
  }
}

/**
 * Removes the passkeys. The statement decides again for itself: only with a
 * list, only passkeys still off it, and never while the site is adding one, so
 * a passkey trusted since the check read the account is left alone. Returns the
 * ids removed.
 */
async function removePasskeys(userId: string, ids: string[]): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const removed = (await db.execute(sql`
    delete from auth.webauthn_credentials w
    using auth.users u
    where u.id = ${userId}::uuid
      and w.user_id = u.id
      and w.id::text in (select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))
      and ${HAS_LIST}
      and w.id::text not in (select lower(value) from jsonb_array_elements_text(u.raw_app_meta_data -> 'trusted_passkeys'))
      and coalesce(
            case when jsonb_typeof(u.raw_app_meta_data -> 'passkey_pending' -> 'until') = 'number'
              then (u.raw_app_meta_data -> 'passkey_pending' ->> 'until')::numeric end,
            0) <= ${NOW_MS}
    returning w.id`)) as unknown as Array<{ id: string }>;
  const gone = (removed ?? []).map((row) => String(row.id).toLowerCase());
  await closeQueuedAlerts(userId, gone);
  return gone;
}

/**
 * Checks the account's passkeys on every request (getAuthState) and when a
 * passkey signs in (finishPasskeySignInAction). "removed" means a passkey
 * nobody added through the site was on the account: it has been taken off,
 * every session ended and the owner told, and this request must not count as
 * signed in. Errors leave the session and the passkeys alone; the next request
 * tries again.
 */
export async function checkTrustedPasskeys(user: { id: string }): Promise<"ok" | "removed"> {
  let remove: string[];
  try {
    const state = await readPasskeyState(user.id);
    // Unreadable is not "untrusted": nothing is known, so nothing is done.
    if (!state) return "ok";
    const review = reviewPasskeys(state);
    if (review.baseline) {
      await writeBaseline(user.id);
      return "ok";
    }
    if (review.remove.length === 0) return "ok";
    remove = review.remove;
  } catch (error) {
    console.error("Passkeys could not be checked", error);
    return "ok";
  }

  // Refused from here on, whether or not this request is the one that cleans up.
  // The claim keeps concurrent requests from telling the owner twice. With the
  // shared store down the removal still runs (it is safe to repeat), and only
  // a request that actually removed something reports it.
  const claim = await claimOnce(`untrusted-passkey-removal:${user.id}`, 60_000);
  if (claim !== "duplicate") {
    try {
      const removed = await removePasskeys(user.id, remove);
      if (removed.length === 0) {
        // The delete found nothing it may remove. Either the site trusted the
        // passkey in the meantime (or began adding one), and then this request
        // is an ordinary one; or another request removed it first, and then
        // this one is refused like that one was.
        const again = await readPasskeyState(user.id);
        const second = again ? reviewPasskeys(again) : null;
        const stillThere = again ? remove.some((id) => again.passkeys.includes(id)) : false;
        if (second && !second.baseline && second.remove.length === 0 && stillThere) return "ok";
        if (stillThere) console.error("An unrecognised passkey could not be removed");
        return "removed";
      }
      await endAllSessions(user.id);
      await recordAudit({
        action: "auth.passkey_unrecognised_removed",
        actorId: user.id,
        by: "system",
        targetType: "user",
        targetId: user.id,
        metadata: { passkeyIds: removed },
      });
      // The removal notice for a login nobody added through the site, worded for a passkey.
      await notifyLinkedLoginRemoved(user.id, ["passkey"]);
    } catch (error) {
      console.error("An unrecognised passkey could not be removed", error);
    }
  }
  return "removed";
}

/**
 * finishPasskeyRegistrationAction, just before Supabase is asked to store the
 * passkey. Records the add in progress, and gives an account that has no list
 * yet its baseline first, so the id written afterwards joins the passkeys the
 * account already had instead of replacing them. False when it could not be
 * recorded: the passkey must then not be stored at all.
 */
export async function markPasskeyPending(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const rows = (await db.execute(sql`
      update auth.users u
      set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'trusted_passkeys', case when ${HAS_LIST} then u.raw_app_meta_data -> 'trusted_passkeys' else ${CURRENT} end,
        'passkey_pending', jsonb_build_object('until', (${NOW_MS})::bigint + ${PASSKEY_PENDING_MS}::bigint))
      where u.id = ${userId}::uuid
      returning u.id`)) as unknown as unknown[];
    return (rows?.length ?? 0) === 1;
  } catch (error) {
    console.error("A pending passkey could not be recorded", error);
    return false;
  }
}

/**
 * finishPasskeyRegistrationAction, once Supabase has stored the passkey: its id
 * joins the trusted list. Tried a few times, because the passkey already
 * exists and is removed if this never lands. False when it did not.
 */
export async function trustPasskey(userId: string, passkeyId: string): Promise<boolean> {
  const db = getDb();
  const id = passkeyId.trim().toLowerCase();
  if (!db || !UUID.test(id)) return false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // An account whose list has gone missing gets its baseline here too:
      // the new passkey is on the account by now, so it is part of it.
      const rows = (await db.execute(sql`
        update auth.users u
        set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
          'trusted_passkeys',
          (select coalesce(jsonb_agg(distinct lower(value)), '[]'::jsonb)
             from jsonb_array_elements_text(
               (case when ${HAS_LIST} then u.raw_app_meta_data -> 'trusted_passkeys' else ${CURRENT} end)
               || ${JSON.stringify([id])}::jsonb)))
        where u.id = ${userId}::uuid
        returning u.id`)) as unknown as unknown[];
      if ((rows?.length ?? 0) === 1) return true;
    } catch (error) {
      console.error(`A new passkey could not be trusted (attempt ${attempt})`, error);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
  }
  return false;
}

/**
 * deletePasskeyAction, once Supabase has removed the passkey: its id leaves the
 * list. An id left behind trusts nothing (ids are never reused), so a failure
 * is only logged.
 */
export async function forgetPasskey(userId: string, passkeyId: string): Promise<void> {
  const db = getDb();
  const id = passkeyId.trim().toLowerCase();
  if (!db || !UUID.test(id)) return;
  try {
    await db.execute(sql`
      update auth.users u
      set raw_app_meta_data = u.raw_app_meta_data || jsonb_build_object(
        'trusted_passkeys',
        (select coalesce(jsonb_agg(value), '[]'::jsonb)
           from jsonb_array_elements_text(u.raw_app_meta_data -> 'trusted_passkeys')
          where lower(value) <> ${id}::text))
      where u.id = ${userId}::uuid and ${HAS_LIST}`);
  } catch (error) {
    console.error("A removed passkey could not be taken off the trusted list", error);
  }
}
