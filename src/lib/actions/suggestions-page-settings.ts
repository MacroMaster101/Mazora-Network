"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { getSupportCards, SUPPORT_CARDS_KEY } from "@/lib/data/support-settings";
import { updateSiteGeneralSettings } from "@/lib/data/site-settings";

export interface SuggestionsPageResult {
  ok: boolean;
  message: string;
}

const schemaFields = z.object({
  eyebrow: z.string().trim().min(1, "The eyebrow cannot be empty.").max(60),
  title: z.string().trim().min(1, "The page title cannot be empty.").max(80),
  lead: z.string().trim().min(1, "The intro cannot be empty.").max(400),
  enabled: z.boolean(),
});

/**
 * Saves the public suggestions page's hero wording and its open/closed state.
 *
 * Only the three fields the page actually renders are written. The card's
 * other managed-page fields (ticket type, the preparation checklist, the
 * privacy note) are preserved untouched: the suggestions route does not render
 * them, but they belong to the shared Support card shape and blanking them
 * here would silently empty them for anything that does.
 */
export async function saveSuggestionsPageAction(formData: FormData): Promise<SuggestionsPageResult> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in." };
  if (!(await canManageSuggestions(session, userId))) {
    return { ok: false, message: "You don't have permission to edit the suggestions page." };
  }

  const parsed = schemaFields.safeParse({
    eyebrow: String(formData.get("eyebrow") ?? ""),
    title: String(formData.get("title") ?? ""),
    lead: String(formData.get("lead") ?? ""),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the page details." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    const cards = await getSupportCards();
    const card = cards.find((item) => item.id === "suggestions");
    if (!card?.page) return { ok: false, message: "The suggestions Support card is missing." };

    const nextCards = cards.map((item) =>
      item.id === "suggestions"
        ? {
            ...item,
            // Merge over the existing page so ticketType/details/privacyNote survive.
            page: { ...item.page!, eyebrow: parsed.data.eyebrow, title: parsed.data.title, lead: parsed.data.lead },
          }
        : item,
    );

    await db
      .insert(schema.siteSettings)
      .values({ settingKey: SUPPORT_CARDS_KEY, settingValue: nextCards })
      .onConflictDoUpdate({
        target: schema.siteSettings.settingKey,
        set: { settingValue: nextCards, updatedAt: new Date() },
      });

    await updateSiteGeneralSettings({ suggestionsEnabled: parsed.data.enabled });

    await db.insert(schema.auditLogs).values({
      actorId: userId,
      action: "suggestions.page.update",
      targetType: "setting",
      targetId: "suggestions",
      metadata: { by: session.username, enabled: parsed.data.enabled, title: parsed.data.title },
    });
  } catch (error) {
    console.error("Failed to save the suggestions page settings", error);
    return { ok: false, message: "Those settings could not be saved." };
  }

  revalidatePath("/support/suggestions");
  revalidatePath("/support");
  revalidatePath("/admin/suggestions/page-edit");

  return {
    ok: true,
    message: parsed.data.enabled ? "Suggestions page updated." : "Suggestions page updated and closed to members.",
  };
}
