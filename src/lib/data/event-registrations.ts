import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { effectiveEventStatus } from "@/lib/events/status";
import type { EventStatus } from "@/lib/types";

/**
 * Event sign-ups (migration 077). Everything here reads through DATABASE_URL.
 *
 * A registration is shown by the member's linked Minecraft name, so every read
 * joins `minecraft_accounts`: someone who unlinks after registering drops off
 * the list and the count together, and the two never disagree. Each read
 * returns an empty result on failure, so the events pages still render if the
 * table is missing (before 077 is applied) or the database is unreachable.
 */

export interface EventRegistrant {
  username: string;
  skinUrl: string | null;
  registeredAt: string;
}

export interface ViewerRegistration {
  signedIn: boolean;
  /** The viewer's linked Minecraft name, or null when they have not linked one. */
  minecraftUsername: string | null;
  registered: boolean;
}

export interface MyEventRegistration {
  slug: string;
  title: string;
  status: EventStatus;
  startISO: string;
  gameMode: string | null;
  registeredAt: string;
}

const iso = (value: Date | string) => (value instanceof Date ? value.toISOString() : String(value));

/** Registrant counts keyed by event id. */
export async function getRegistrationCounts(eventIds: string[]): Promise<Map<string, number>> {
  const db = getDb();
  if (!db || eventIds.length === 0) return new Map();
  try {
    const rows = await db
      .select({ eventId: schema.eventRegistrations.eventId, total: count() })
      .from(schema.eventRegistrations)
      .innerJoin(schema.minecraftAccounts, eq(schema.minecraftAccounts.userId, schema.eventRegistrations.userId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.eventRegistrations.userId))
      .where(and(inArray(schema.eventRegistrations.eventId, eventIds), eq(schema.profiles.accountStatus, "active")))
      .groupBy(schema.eventRegistrations.eventId);
    return new Map(rows.map((r) => [r.eventId, Number(r.total)]));
  } catch (error) {
    console.error("Failed to count event registrations:", error);
    return new Map();
  }
}

/**
 * The most registrants one event can hold: the admin form's ceiling on
 * maxParticipants (events-admin.ts), and registering stops at the event's own
 * limit. The list is never cut short for a real event, but a public page can
 * not be made to read an unbounded number of rows.
 */
export const MAX_EVENT_REGISTRANTS = 5000;

/** Who registered for an event, earliest first. */
export async function getEventRegistrants(eventId: string): Promise<EventRegistrant[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        username: schema.minecraftAccounts.minecraftUsername,
        skinUrl: schema.minecraftAccounts.skinHeadUrl,
        registeredAt: schema.eventRegistrations.createdAt,
      })
      .from(schema.eventRegistrations)
      .innerJoin(schema.minecraftAccounts, eq(schema.minecraftAccounts.userId, schema.eventRegistrations.userId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.eventRegistrations.userId))
      .where(and(eq(schema.eventRegistrations.eventId, eventId), eq(schema.profiles.accountStatus, "active")))
      .orderBy(asc(schema.eventRegistrations.createdAt))
      .limit(MAX_EVENT_REGISTRANTS);
    return rows.map((r) => ({ username: r.username, skinUrl: r.skinUrl, registeredAt: iso(r.registeredAt) }));
  } catch (error) {
    console.error("Failed to load event registrants:", error);
    return [];
  }
}

/** What the register button should offer this viewer. */
export async function getViewerRegistration(eventId: string, userId: string | null): Promise<ViewerRegistration> {
  const empty: ViewerRegistration = { signedIn: Boolean(userId), minecraftUsername: null, registered: false };
  const db = getDb();
  if (!db || !userId) return empty;
  try {
    const [account] = await db
      .select({ username: schema.minecraftAccounts.minecraftUsername })
      .from(schema.minecraftAccounts)
      .where(eq(schema.minecraftAccounts.userId, userId))
      .limit(1);
    const [registration] = await db
      .select({ id: schema.eventRegistrations.id })
      .from(schema.eventRegistrations)
      .where(and(eq(schema.eventRegistrations.eventId, eventId), eq(schema.eventRegistrations.userId, userId)))
      .limit(1);
    return { signedIn: true, minecraftUsername: account?.username ?? null, registered: Boolean(registration) };
  } catch (error) {
    console.error("Failed to load the viewer's event registration:", error);
    return empty;
  }
}

/** The signed-in member's registrations, soonest event first, for the dashboard. */
export async function getMyEventRegistrations(userId: string): Promise<MyEventRegistration[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        slug: schema.events.slug,
        title: schema.events.title,
        status: schema.events.status,
        startAt: schema.events.startAt,
        endAt: schema.events.endAt,
        gameMode: schema.events.gameMode,
        registeredAt: schema.eventRegistrations.createdAt,
      })
      .from(schema.eventRegistrations)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventRegistrations.eventId))
      .where(eq(schema.eventRegistrations.userId, userId))
      .orderBy(desc(schema.events.startAt));
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      status: effectiveEventStatus(r),
      startISO: iso(r.startAt),
      gameMode: r.gameMode,
      registeredAt: iso(r.registeredAt),
    }));
  } catch (error) {
    console.error("Failed to load the member's event registrations:", error);
    return [];
  }
}
