"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { isUuid } from "@/lib/validation/id";

export interface SuggestionActionResult {
  ok: boolean;
  message: string;
}

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
    return { ok: true, message: `Suggestion "${title}" deleted.` };
  } catch (error) {
    console.error("Failed to delete suggestion", error);
    return { ok: false, message: "Failed to delete suggestion." };
  }
}
