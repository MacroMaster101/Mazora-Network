"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageEvents } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { isUuid } from "@/lib/validation/id";
import { isOwnPublicImageUrl, rehostImageFromUrl, storeImageBytes } from "@/lib/news/image-store";
import { isSitePath } from "@/lib/net/safe-url";

export interface EventActionResult {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  /** The saved cover image, so the admin list can show the stored copy. */
  imageUrl?: string | null;
  /** Set on create, so a follow-up edit targets the new row. */
  id?: string;
  /** The saved URL slug: made from the title on create, unchanged on edit. */
  slug?: string;
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

/**
 * Works out the cover image to save: an uploaded file wins, then a pasted link,
 * otherwise the current image stays. Uploads and outside links are copied into
 * our own bucket so a cover never depends on someone else's host staying up.
 */
async function resolveEventImage(
  formData: FormData,
  keyBase: string,
  currentUrl: string | null,
): Promise<{ url: string | null; error?: string }> {
  if (formData.get("removeImage") === "on") return { url: null };

  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) return { url: currentUrl, error: "Cover image must be under 8 MB." };
    const stored = await storeImageBytes(new Uint8Array(await file.arrayBuffer()), `events/${keyBase}-${Date.now()}`);
    if (!stored) return { url: currentUrl, error: "Use a real JPEG, PNG, WebP or GIF under 8 MB." };
    return { url: stored.url };
  }

  const raw = String(formData.get("imageUrl") ?? "").trim();
  if (!raw) return { url: currentUrl };
  if (raw.length > 1000) return { url: currentUrl, error: "That image link is too long." };
  if (isSitePath(raw) || isOwnPublicImageUrl(raw) || raw === currentUrl) return { url: raw };

  const hosted = await rehostImageFromUrl(raw, `events/${keyBase}-${Date.now()}`);
  if (!hosted) return { url: currentUrl, error: "That image link could not be fetched as an image under 8 MB." };
  return { url: hosted.url };
}

/** "Spawn Build-Off!" → "spawn-build-off". */
function slugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : "event";
}

/** The title's slug, or the first free "-2", "-3"… variant when it is taken. */
async function uniqueEventSlug(db: NonNullable<ReturnType<typeof getDb>>, base: string): Promise<string> {
  const rows = await db
    .select({ slug: schema.events.slug })
    .from(schema.events)
    .where(like(schema.events.slug, `${base}%`));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

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

  // An edit keeps its slug so links already shared keep working; a new event
  // gets one made from its title.
  let existing: { imageUrl: string | null; slug: string } | undefined;
  if (eventId) {
    [existing] = await db
      .select({ imageUrl: schema.events.imageUrl, slug: schema.events.slug })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1);
    if (!existing) return { ok: false, message: "That event no longer exists." };
  }
  const title = String(formData.get("title") ?? "").trim();

  const raw = {
    title,
    slug: existing ? existing.slug : await uniqueEventSlug(db, slugFromTitle(title)),
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

  const image = await resolveEventImage(formData, parsed.data.slug, existing?.imageUrl ?? null);
  if (image.error) {
    return { ok: false, message: image.error, errors: { imageUrl: image.error } };
  }

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
          imageUrl: image.url,
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
      return { ok: true, message: `Event "${parsed.data.title}" updated successfully.`, imageUrl: image.url, slug: parsed.data.slug };
    } else {
      // Create new event
      const [inserted] = await db
        .insert(schema.events)
        .values({
          title: parsed.data.title,
          slug: parsed.data.slug,
          description: parsed.data.description || null,
          imageUrl: image.url,
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
      return { ok: true, message: `Event "${parsed.data.title}" created successfully.`, imageUrl: image.url, id: inserted?.id, slug: parsed.data.slug };
    }
  } catch (error: unknown) {
    console.error("Failed to save event", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505") {
      return { ok: false, message: "Another event was just saved with the same title. Please try again." };
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
