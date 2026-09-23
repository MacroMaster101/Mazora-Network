import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { providerAvatarsFor } from "@/lib/data/provider-avatars";
import { announcePresenceChange } from "@/lib/presence/announce";
import { isRoleKey, isStaff, normalizeRoleKey } from "@/lib/auth/roles";
import { ensureRoleCatalog } from "@/lib/data/roles";
import type { Role } from "@/lib/types";
import {
  ACTIVE_RESOLUTION_MS,
  HEARTBEAT_THROTTLE_MS,
  IDLE_AFTER_MS,
  isPresenceChoice,
  lastActiveFrom,
  leftAt,
  ONLINE_WINDOW_MS,
  presenceChanged,
  shownPresence,
  type PresenceChoice,
  type PresenceShown,
} from "@/lib/presence-rules";

export interface OnlineMember {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
  status: Exclude<PresenceShown, "offline">;
}

/** Kept for the staff panel, which shows the same rows filtered to staff. */
export type OnlineStaffMember = OnlineMember;

/**
 * Record a heartbeat.
 *
 * `idleMs` is how long ago the member last interacted with the page. It sets
 * last_active_at to that moment (never backwards), so "Idle" starts five
 * minutes after the last click rather than five minutes after whichever
 * heartbeat happened to carry it.
 *
 * Nothing is written for an invisible member — not recording their activity is
 * a stronger guarantee than recording it and hiding it. The throttle lives in
 * the WHERE clause, so two tabs cannot both decide the row is stale and write.
 */
export async function recordActivity(userId: string, idleMs: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - HEARTBEAT_THROTTLE_MS);
  const activeAt = lastActiveFrom(now, idleMs);
  try {
    // What others saw before this heartbeat, so an arrival or an Idle ↔ Online
    // flip can be announced — and the ordinary keep-alive beats, which change
    // nothing, stay silent.
    const [before] = await db
      .select({
        choice: schema.profiles.presenceStatus,
        lastSeenAt: schema.profiles.lastSeenAt,
        lastActiveAt: schema.profiles.lastActiveAt,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    const updated = await db
      .update(schema.profiles)
      .set(
        activeAt
          ? {
              lastSeenAt: now,
              // greatest() skips a null, and keeps a later moment another tab already recorded.
              lastActiveAt: sql`greatest(${schema.profiles.lastActiveAt}, ${activeAt.toISOString()}::timestamptz)`,
            }
          : { lastSeenAt: now },
      )
      .where(
        and(
          eq(schema.profiles.userId, userId),
          ne(schema.profiles.presenceStatus, "invisible"),
          or(
            isNull(schema.profiles.lastSeenAt),
            lt(schema.profiles.lastSeenAt, staleBefore),
            // An active heartbeat must still land when the row is fresh but the
            // interaction is newer than what is stored, or coming back from
            // idle would wait out the throttle.
            activeAt
              ? or(
                  isNull(schema.profiles.lastActiveAt),
                  lt(schema.profiles.lastActiveAt, new Date(activeAt.getTime() - ACTIVE_RESOLUTION_MS)),
                )
              : undefined,
            // The first beat after the idle period is up lands at once, so going
            // idle can be announced. It fires once: after it, last_seen_at is
            // past the idle point and this no longer matches.
            activeAt
              ? undefined
              : and(
                  lt(schema.profiles.lastActiveAt, new Date(now.getTime() - IDLE_AFTER_MS)),
                  sql`${schema.profiles.lastSeenAt} < ${schema.profiles.lastActiveAt} + make_interval(secs => ${IDLE_AFTER_MS / 1000})`,
                ),
          ),
        ),
      )
      .returning({ lastSeenAt: schema.profiles.lastSeenAt, lastActiveAt: schema.profiles.lastActiveAt });
    const [after] = updated;
    if (after && before && isPresenceChoice(before.choice)) {
      const changed = presenceChanged(
        {
          choice: before.choice,
          lastSeenAt: before.lastSeenAt ? new Date(before.lastSeenAt) : null,
          lastActiveAt: before.lastActiveAt ? new Date(before.lastActiveAt) : null,
        },
        {
          lastSeenAt: after.lastSeenAt ? new Date(after.lastSeenAt) : null,
          lastActiveAt: after.lastActiveAt ? new Date(after.lastActiveAt) : null,
        },
        now,
      );
      if (changed) await announcePresenceChange();
    }
    return updated.length > 0;
  } catch {
    return false;
  }
}

/**
 * The member closed their last tab: take them off the online lists now rather
 * than when the online window runs out.
 *
 * Only a member currently counted as online is touched, so a repeated call is a
 * no-op and announces nothing. If they are still on the site elsewhere — another
 * browser, their phone — that device's next heartbeat brings them back.
 *
 * `receivedAt` is when the request arrived. A refresh sends "left" from the old
 * page and a heartbeat from the new one almost together, and either can finish
 * first; a heartbeat written after the leave arrived means the member is back,
 * so the leave then changes nothing.
 */
export async function recordLeaving(userId: string, receivedAt: Date): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const now = new Date();
  try {
    const left = await db
      .update(schema.profiles)
      .set({ lastSeenAt: leftAt(now) })
      .where(
        and(
          eq(schema.profiles.userId, userId),
          ne(schema.profiles.presenceStatus, "invisible"),
          gte(schema.profiles.lastSeenAt, new Date(now.getTime() - ONLINE_WINDOW_MS)),
          lte(schema.profiles.lastSeenAt, receivedAt),
        ),
      )
      .returning({ userId: schema.profiles.userId });
    if (left.length) await announcePresenceChange();
    return left.length > 0;
  } catch {
    return false;
  }
}

/** The member's own chosen status, for their menu and settings. */
export async function getPresenceChoice(userId: string): Promise<PresenceChoice> {
  const db = getDb();
  if (!db) return "online";
  try {
    const [row] = await db
      .select({ status: schema.profiles.presenceStatus })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);
    return isPresenceChoice(row?.status) ? row.status : "online";
  } catch {
    return "online";
  }
}

/** Everyone currently shown as online, idle or do-not-disturb, most recently seen first. */
export async function getOnlineMembers(): Promise<OnlineMember[]> {
  const db = getDb();
  if (!db) return [];

  // Reached from the public online panels with no prior getSession() call.
  await ensureRoleCatalog();

  const now = new Date();
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);
  try {
    /*
      The role comes from auth.users' app_metadata, NOT profiles.role.

      Roles are written to app_metadata by the service key (see accounts.ts),
      and that is what every session resolves its role from. profiles.role is a
      stale column that reads "member" even for Web Dev and owners. DATABASE_URL
      connects as a role that can read the auth schema, so this stays one query.
    */
    const rows = await db.execute(sql`
      select
        p.user_id                            as "userId",
        p.username                           as "username",
        p.display_name                       as "displayName",
        p.avatar_url                         as "avatarUrl",
        p.presence_status                    as "choice",
        p.last_seen_at                       as "lastSeenAt",
        p.last_active_at                     as "lastActiveAt",
        u.raw_app_meta_data ->> 'role'       as "role"
      from profiles p
      join auth.users u on u.id = p.user_id
      where p.last_seen_at is not null
        -- Bound as an ISO string: postgres-js cannot serialise a JS Date passed
        -- through a raw sql template (the query builder only manages it via column types).
        and p.last_seen_at >= ${since.toISOString()}::timestamptz
        and p.account_status = 'active'
        and p.presence_status <> 'invisible'
      order by p.last_seen_at desc
    `);

    // Provider photos for members who never chose an avatar — the same
    // resolution the header does, so one person is not a photo there and a
    // monogram here.
    const providerAvatars = await providerAvatarsFor(
      (rows as Array<Record<string, unknown>>).filter((row) => !row.avatarUrl).map((row) => String(row.userId)),
    );

    const members: OnlineMember[] = [];
    for (const row of rows as Array<Record<string, unknown>>) {
      const choice = isPresenceChoice(row.choice) ? row.choice : "online";
      const status = shownPresence({
        choice,
        lastSeenAt: row.lastSeenAt ? new Date(String(row.lastSeenAt)) : null,
        lastActiveAt: row.lastActiveAt ? new Date(String(row.lastActiveAt)) : null,
        now,
      });
      if (status === "offline") continue;
      // normalizeRoleKey: legacy key read as web_dev until migration 055 (removable after).
      const storedRole = normalizeRoleKey(row.role);
      const role = isRoleKey(storedRole) ? storedRole : "member";
      members.push({
        userId: String(row.userId),
        username: String(row.username),
        displayName: typeof row.displayName === "string" ? row.displayName : null,
        avatarUrl:
          typeof row.avatarUrl === "string" ? row.avatarUrl : providerAvatars.get(String(row.userId)) ?? null,
        role,
        status,
      });
    }
    return members;
  } catch (error) {
    // Degrade to an empty panel, but never silently: an empty roster is
    // indistinguishable from "nobody online" and hid a broken query once.
    console.error("getOnlineMembers failed", error);
    return [];
  }
}

/**
 * The status to show beside each of these members, for lists that are not the
 * online panels: a staff roster, a profile, a comment, the admin directory.
 *
 * Only members who are actually shown get an entry — invisible members, stale
 * rows and suspended accounts are simply absent, so a caller that renders a dot
 * per entry cannot accidentally reveal one.
 */
export async function getPresenceFor(userIds: Array<string | null | undefined>): Promise<Map<string, Exclude<PresenceShown, "offline">>> {
  const shown = new Map<string, Exclude<PresenceShown, "offline">>();
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return shown;

  const db = getDb();
  if (!db) return shown;

  const now = new Date();
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);
  try {
    const rows = await db
      .select({
        userId: schema.profiles.userId,
        choice: schema.profiles.presenceStatus,
        lastSeenAt: schema.profiles.lastSeenAt,
        lastActiveAt: schema.profiles.lastActiveAt,
      })
      .from(schema.profiles)
      .where(
        and(
          inArray(schema.profiles.userId, ids),
          eq(schema.profiles.accountStatus, "active"),
          ne(schema.profiles.presenceStatus, "invisible"),
          gte(schema.profiles.lastSeenAt, since),
        ),
      );

    for (const row of rows) {
      const status = shownPresence({
        choice: isPresenceChoice(row.choice) ? row.choice : "online",
        lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
        lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt) : null,
        now,
      });
      if (status !== "offline") shown.set(row.userId, status);
    }
  } catch (error) {
    // A missing dot is the right failure: never take a roster or thread down for it.
    console.error("getPresenceFor failed", error);
  }
  return shown;
}

/** The staff subset of who is online. The staff test stays the role ladder's. */
export function onlyStaff(members: OnlineMember[]): OnlineStaffMember[] {
  return members.filter((member) => isStaff(member.role));
}

/** Everyone online who is not staff — the community list, without repeating the team. */
export function withoutStaff(members: OnlineMember[]): OnlineMember[] {
  return members.filter((member) => !isStaff(member.role));
}
