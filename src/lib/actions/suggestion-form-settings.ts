"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import {
  DEFAULT_SUGGESTION_FORM,
  SUGGESTION_FORM_KEY,
  getSuggestionFormSettings,
} from "@/lib/data/suggestion-form-settings";

export interface SuggestionFormSettingsResult {
  ok: boolean;
  message: string;
}

/**
 * Categories are the load-bearing field: the public form renders one control
 * per entry and the board validates a submitted category against this list, so
 * an empty list would leave members unable to post at all. At least one is
 * required, and duplicates are rejected because two identical radios cannot be
 * told apart once submitted.
 */
const settingsSchema = z.object({
  categories: z
    .array(z.string().trim().min(1, "A category cannot be blank.").max(40, "Keep categories under 40 characters."))
    .min(1, "Keep at least one category — members choose one when posting.")
    .max(12, "Twelve categories is the most the form can show clearly."),
  titlePlaceholder: z.string().trim().min(1).max(160),
  descriptionPlaceholder: z.string().trim().min(1).max(300),
  footnote: z.string().trim().min(1).max(300),
});

export async function saveSuggestionFormSettingsAction(formData: FormData): Promise<SuggestionFormSettingsResult> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in." };
  if (!(await canManageSuggestions(session, userId))) {
    return { ok: false, message: "You don't have permission to edit the suggestion form." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(String(formData.get("suggestionFormJson") ?? ""));
  } catch {
    return { ok: false, message: "Invalid form data." };
  }

  const parsed = settingsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form settings." };
  }

  const categories = parsed.data.categories.map((c) => c.trim());
  if (new Set(categories.map((c) => c.toLowerCase())).size !== categories.length) {
    return { ok: false, message: "Each category must be unique." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const before = await getSuggestionFormSettings();
  const value = { ...DEFAULT_SUGGESTION_FORM, ...parsed.data, categories };

  try {
    await db
      .insert(schema.siteSettings)
      .values({ settingKey: SUGGESTION_FORM_KEY, settingValue: value })
      .onConflictDoUpdate({
        target: schema.siteSettings.settingKey,
        set: { settingValue: value, updatedAt: new Date() },
      });
    await db.insert(schema.auditLogs).values({
      actorId: userId,
      action: `${SUGGESTION_FORM_KEY}.update`,
      targetType: "setting",
      targetId: SUGGESTION_FORM_KEY,
      metadata: { before, after: value, by: session.username },
    });
  } catch (error) {
    console.error("Failed to save suggestion form settings", error);
    return { ok: false, message: "Those settings could not be saved." };
  }

  // The composer and the board's category filters both read this.
  revalidatePath("/support/suggestions");
  revalidatePath("/support/suggestions/new");
  revalidatePath("/admin/suggestions/form-edit");

  return { ok: true, message: "Suggestion form updated." };
}
