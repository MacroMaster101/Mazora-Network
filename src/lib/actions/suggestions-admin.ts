"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { isUuid } from "@/lib/validation/id";
import { getSuggestionRepliesForAdmin, type AdminReply } from "@/lib/data/suggestions";
import { removeSuggestionImageObject } from "@/lib/suggestions/image-store";

export interface SuggestionActionResult {
  ok: boolean;
  message: string;
}

/** Matches the public submit path exactly (src/lib/actions/support.ts). */
const contentSchema = z.object({
  title: z.string().trim().min(4, "Give this idea a short title.").max(160, "Keep the title under 160 characters."),
  category: z.string().trim().min(1, "Choose a category.").max(60, "That category is too long."),
  description: z
    .string()
    .trim()
    .min(20, "Explain the idea (min 20 chars).")
    .max(10_000, "Keep the description under 10,000 characters."),
});

export async function updateSuggestionStatusAction(formData: FormData): Promise<SuggestionActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageSuggestions(session, userId);
  if (!session || !allowed) {
    return { ok: false, message: "You don't have permission to manage suggestions." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "Database is not connected." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "open");
  const title = String(formData.get("title") ?? "Suggestion");

  if (!isUuid(id)) return { ok: false, message: "That suggestion no longer exists." };

  const validStatuses = ["open", "under_review", "planned", "completed", "declined"];
  if (!validStatuses.includes(status)) {
    return { ok: false, message: "Invalid suggestion status." };
  }

  try {
    await db
      .update(schema.suggestions)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(schema.suggestions.id, id));

    await db.insert(schema.auditLogs).values({
      action: "suggestions.status_update",
      targetType: "suggestion",
      targetId: id,
      metadata: { title, status, by: session.username },
    });

    revalidatePath("/admin/suggestions");
    return { ok: true, message: `Suggestion status updated to ${status.replace("_", " ")}.` };
  } catch (error) {
    console.error("Failed to update suggestion status", error);
    return { ok: false, message: "Failed to update status." };
  }
}

/**
 * Edits a suggestion's title, category and description. Mirrors
 * updateSuggestionStatusAction above: same permission gate, same error
 * shape, same audit-row style — the only difference is which columns it
 * writes and what it validates.
 */
export async function updateSuggestionContentAction(formData: FormData): Promise<SuggestionActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageSuggestions(session, userId);
  if (!session || !allowed) {
    return { ok: false, message: "You don't have permission to manage suggestions." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "Database is not connected." };

  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { ok: false, message: "That suggestion no longer exists." };

  const parsed = contentSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Invalid suggestion content." };
  }

  try {
    const [updated] = await db
      .update(schema.suggestions)
      .set({
        title: parsed.data.title,
        category: parsed.data.category,
        description: parsed.data.description,
        updatedAt: new Date(),
      })
      .where(eq(schema.suggestions.id, id))
      .returning({ id: schema.suggestions.id });
    if (!updated) return { ok: false, message: "That suggestion no longer exists." };

    await db.insert(schema.auditLogs).values({
      action: "suggestions.edit",
      targetType: "suggestion",
      targetId: id,
      metadata: { title: parsed.data.title, category: parsed.data.category, by: session.username },
    });

    revalidatePath("/admin/suggestions");
    revalidatePath("/admin/suggestions/board");
    revalidatePath("/support/suggestions");
    revalidatePath(`/support/suggestions/${id}`);
    return { ok: true, message: "Suggestion updated." };
  } catch (error) {
    console.error("Failed to update suggestion content", error);
    return { ok: false, message: "Failed to update suggestion." };
  }
}

export interface AdminRepliesResult {
  ok: boolean;
  message: string;
  replies: AdminReply[];
}

/**
 * Lazily loads a thread's replies for the admin drill-down, including
 * soft-deleted ones (rendered as tombstones client-side). Staff-only, same
 * permission gate as every other action in this file.
 */
export async function loadSuggestionRepliesAction(suggestionId: string): Promise<AdminRepliesResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageSuggestions(session, userId);
  if (!session || !allowed) {
    return { ok: false, message: "You don't have permission to manage suggestions.", replies: [] };
  }

  if (!isUuid(suggestionId)) {
    return { ok: false, message: "That suggestion no longer exists.", replies: [] };
  }

  const replies = await getSuggestionRepliesForAdmin(suggestionId);
  return { ok: true, message: "", replies };
}

export async function deleteSuggestionAction(formData: FormData): Promise<SuggestionActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageSuggestions(session, userId);
  if (!session || !allowed) {
    return { ok: false, message: "You don't have permission to delete suggestions." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "Database is not connected." };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "Suggestion");

  if (!isUuid(id)) return { ok: false, message: "That suggestion no longer exists." };

  // Collect every image's storage key before the hard delete: the FK cascade
  // (migration 042) removes the suggestion_images rows for this suggestion
  // and for all of its replies, and once those rows are gone there is no
  // storage_key left to find the stored objects by.
  let imageStorageKeys: string[] = [];
  try {
    const replyRows = await db
      .select({ id: schema.suggestionReplies.id })
      .from(schema.suggestionReplies)
      .where(eq(schema.suggestionReplies.suggestionId, id));
    const replyIds = replyRows.map((row) => row.id);

    const imageRows = await db
      .select({ storageKey: schema.suggestionImages.storageKey })
      .from(schema.suggestionImages)
      .where(
        replyIds.length
          ? or(eq(schema.suggestionImages.suggestionId, id), inArray(schema.suggestionImages.replyId, replyIds))
          : eq(schema.suggestionImages.suggestionId, id),
      );
    imageStorageKeys = imageRows.map((row) => row.storageKey);
  } catch (error) {
    console.error("Failed to collect suggestion image storage keys before delete", error);
  }

  try {
    // Delete related votes first if any
    await db.delete(schema.suggestionVotes).where(eq(schema.suggestionVotes.suggestionId, id));
    await db.delete(schema.suggestions).where(eq(schema.suggestions.id, id));

    await db.insert(schema.auditLogs).values({
      action: "suggestions.delete",
      targetType: "suggestion",
      targetId: id,
      metadata: { title, by: session.username },
    });

    revalidatePath("/admin/suggestions");

    // Storage cleanup happens after the hard delete succeeds, and never fails
    // the delete itself — the rows are already gone either way.
    try {
      await Promise.all(imageStorageKeys.map((storageKey) => removeSuggestionImageObject(storageKey)));
    } catch (error) {
      console.error("Failed to clean up images for deleted suggestion", error);
    }

    return { ok: true, message: `Suggestion "${title}" deleted.` };
  } catch (error) {
    console.error("Failed to delete suggestion", error);
    return { ok: false, message: "Failed to delete suggestion." };
  }
}
