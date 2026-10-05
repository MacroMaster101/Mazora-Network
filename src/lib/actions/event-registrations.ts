"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { getSession, getSessionUserId } from "@/lib/auth";
import { getDb, schema } from "@/lib/db/client";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validation/id";
import { effectiveEventStatus, registrationOpen } from "@/lib/events/status";

export interface EventRegistrationResult {
  ok: boolean;
  message: string;
}

function refreshEventPages(slug: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${slug}`);
  revalidatePath("/dashboard/events");
  revalidatePath("/admin/events");
}

async function signedInMember() {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  return session && userId ? userId : null;
}

/**
 * Registers the signed-in member for an event. Requires a linked Minecraft
 * account (the event's entry requirement, and the name shown on the list).
 * The event row is locked while the cap is checked, so two people cannot both
 * take the last place.
 */
export async function registerForEventAction(input: { eventId: string }): Promise<EventRegistrationResult> {
  const userId = await signedInMember();
  if (!userId) return { ok: false, message: "Sign in to register for events." };
  if (!isUuid(input?.eventId)) return { ok: false, message: "That event no longer exists." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const limit = await rateLimitShared(await actionClientKey("event-register", userId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many attempts. Wait a moment and try again." };

  const [account] = await db
    .select({ id: schema.minecraftAccounts.id })
    .from(schema.minecraftAccounts)
    .where(eq(schema.minecraftAccounts.userId, userId))
    .limit(1);
  if (!account) return { ok: false, message: "Link your Minecraft account before registering." };

  try {
    const outcome = await db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          slug: schema.events.slug,
          title: schema.events.title,
          status: schema.events.status,
          startAt: schema.events.startAt,
          endAt: schema.events.endAt,
          maxParticipants: schema.events.maxParticipants,
        })
        .from(schema.events)
        .where(eq(schema.events.id, input.eventId))
        .limit(1)
        .for("update");
      if (!event) return { ok: false, message: "That event no longer exists." } as const;
      // Sign-ups stay open until the event ends (see effectiveEventStatus).
      if (!registrationOpen(effectiveEventStatus(event))) {
        return { ok: false, message: "Registration for this event is closed." } as const;
      }

      const [already] = await tx
        .select({ id: schema.eventRegistrations.id })
        .from(schema.eventRegistrations)
        .where(and(eq(schema.eventRegistrations.eventId, input.eventId), eq(schema.eventRegistrations.userId, userId)))
        .limit(1);
      if (already) return { ok: true, message: "You're already registered.", slug: event.slug } as const;

      if (event.maxParticipants) {
        const [taken] = await tx
          .select({ total: count() })
          .from(schema.eventRegistrations)
          .where(eq(schema.eventRegistrations.eventId, input.eventId));
        if (Number(taken?.total ?? 0) >= event.maxParticipants) {
          return { ok: false, message: "This event is full." } as const;
        }
      }

      await tx.insert(schema.eventRegistrations).values({ eventId: input.eventId, userId });
      return { ok: true, message: `You're registered for ${event.title}.`, slug: event.slug } as const;
    });

    if ("slug" in outcome && outcome.slug) refreshEventPages(outcome.slug);
    return { ok: outcome.ok, message: outcome.message };
  } catch (error) {
    console.error("Failed to register for event", error);
    return { ok: false, message: "Registration could not be saved. Please try again." };
  }
}

/** Removes the signed-in member's registration while the event is still open. */
export async function leaveEventAction(input: { eventId: string }): Promise<EventRegistrationResult> {
  const userId = await signedInMember();
  if (!userId) return { ok: false, message: "Sign in to manage your registrations." };
  if (!isUuid(input?.eventId)) return { ok: false, message: "That event no longer exists." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const limit = await rateLimitShared(await actionClientKey("event-register", userId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many attempts. Wait a moment and try again." };

  try {
    const [event] = await db
      .select({
        slug: schema.events.slug,
        status: schema.events.status,
        startAt: schema.events.startAt,
        endAt: schema.events.endAt,
      })
      .from(schema.events)
      .where(eq(schema.events.id, input.eventId))
      .limit(1);
    if (!event) return { ok: false, message: "That event no longer exists." };
    // Results and winners are settled once an event ends, so the list is kept as it was.
    if (!registrationOpen(effectiveEventStatus(event))) {
      return { ok: false, message: "This event has ended, so the list can't change." };
    }

    await db
      .delete(schema.eventRegistrations)
      .where(and(eq(schema.eventRegistrations.eventId, input.eventId), eq(schema.eventRegistrations.userId, userId)));
    refreshEventPages(event.slug);
    return { ok: true, message: "You've left the event." };
  } catch (error) {
    console.error("Failed to leave event", error);
    return { ok: false, message: "That could not be saved. Please try again." };
  }
}
