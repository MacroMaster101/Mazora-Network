"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageEvents } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { isUuid } from "@/lib/validation/id";

export interface EventActionResult {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
}

const eventFormSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120, "Keep title under 120 characters."),
  slug: z.string().trim().min(2, "Slug is required.").max(80, "Keep slug under 80 characters.").regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and dashes."),
  description: z.string().trim().max(2000, "Description must be under 2,000 characters.").optional(),
  gameMode: z.string().trim().min(1, "Game mode is required.").max(80),
  status: z.enum(["upcoming", "live", "completed", "cancelled"]).default("upcoming"),
  startAt: z.string().trim().min(1, "Start date/time is required."),
  endAt: z.string().trim().optional(),
  maxParticipants: z.coerce.number().int().min(1).max(5000).default(100),
  rewards: z.string().trim().optional(),
});

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function saveEventAction(
  _prev: unknown,
  formData: FormData,
): Promise<EventActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageEvents(session, userId);
  if (!session || !allowed) {
    return { ok: false, message: "You don't have permission to manage events." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "Database not connected." };

  const eventId = formData.get("id") ? String(formData.get("id")) : null;
  if (eventId && !isUuid(eventId)) return { ok: false, message: "That event no longer exists." };

  const raw = {
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    description: String(formData.get("description") ?? "").trim(),
    gameMode: String(formData.get("gameMode") ?? "").trim(),
    status: String(formData.get("status") ?? "upcoming"),
    startAt: String(formData.get("startAt") ?? "").trim(),
    endAt: String(formData.get("endAt") ?? "").trim(),
    maxParticipants: Number(formData.get("maxParticipants") ?? 100),
    rewards: String(formData.get("rewards") ?? "").trim(),
  };

  const parsed = eventFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Please resolve the form errors.", errors: zodErrors(parsed.error) };
  }

  const rewardsArray = parsed.data.rewards
    ? parsed.data.rewards.split("\n").map((r) => r.trim()).filter(Boolean)
    : [];

  const startDate = new Date(parsed.data.startAt);
  const endDate = parsed.data.endAt ? new Date(parsed.data.endAt) : null;

  try {
    if (eventId) {
      // Update existing event
      await db
        .update(schema.events)
        .set({
          title: parsed.data.title,
          slug: parsed.data.slug,
          description: parsed.data.description || null,
          gameMode: parsed.data.gameMode,
          status: parsed.data.status,
          startAt: startDate,
          endAt: endDate,
          maxParticipants: parsed.data.maxParticipants,
          rewards: rewardsArray,
          updatedAt: new Date(),
        })
        .where(eq(schema.events.id, eventId));

      await db.insert(schema.auditLogs).values({
        action: "events.update",
        targetType: "event",
        targetId: eventId,
        metadata: { title: parsed.data.title, slug: parsed.data.slug, by: session.username },
      });

      revalidatePath("/admin/events");
      revalidatePath("/events");
      return { ok: true, message: `Event "${parsed.data.title}" updated successfully.` };
    } else {
      // Create new event
      const [inserted] = await db
        .insert(schema.events)
        .values({
          title: parsed.data.title,
          slug: parsed.data.slug,
          description: parsed.data.description || null,
          gameMode: parsed.data.gameMode,
          status: parsed.data.status,
          startAt: startDate,
          endAt: endDate,
          maxParticipants: parsed.data.maxParticipants,
          rewards: rewardsArray,
        })
        .returning({ id: schema.events.id });

      await db.insert(schema.auditLogs).values({
        action: "events.create",
        targetType: "event",
        targetId: inserted?.id ?? parsed.data.slug,
        metadata: { title: parsed.data.title, slug: parsed.data.slug, by: session.username },
      });

      revalidatePath("/admin/events");
      revalidatePath("/events");
      return { ok: true, message: `Event "${parsed.data.title}" created successfully.` };
    }
  } catch (error: unknown) {
    console.error("Failed to save event", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505") {
      return { ok: false, message: "An event with this URL slug already exists. Please choose a different slug." };
    }
    return { ok: false, message: "Failed to save event. Database error occurred." };
  }
}

export async function deleteEventAction(formData: FormData): Promise<EventActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageEvents(session, userId);
  if (!session || !allowed) {
    return { ok: false, message: "You don't have permission to delete events." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "Database not connected." };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "Event");

  if (!isUuid(id)) return { ok: false, message: "That event no longer exists." };

  try {
    await db.delete(schema.events).where(eq(schema.events.id, id));

    await db.insert(schema.auditLogs).values({
      action: "events.delete",
      targetType: "event",
      targetId: id,
      metadata: { title, by: session.username },
    });

    revalidatePath("/admin/events");
    revalidatePath("/events");
    return { ok: true, message: `Event "${title}" has been deleted.` };
  } catch (error) {
    console.error("Failed to delete event", error);
    return { ok: false, message: "Failed to delete event." };
  }
}
