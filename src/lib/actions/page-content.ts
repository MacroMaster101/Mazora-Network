"use server";

import { revalidatePath } from "next/cache";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canEditPageContent } from "@/lib/auth/page-access";
import { getDb, schema } from "@/lib/db/client";
import { PAGE_CONTENT_SETTING_PREFIX, readPageContentForUpdate, updatePageContent } from "@/lib/data/page-content";
import { isEditablePageId, PAGE_CONTENT_DEFINITIONS } from "@/lib/page-content";

export interface PageContentActionResult {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  content?: Record<string, string>;
}

export async function savePageContentAction(_previous: unknown, formData: FormData): Promise<PageContentActionResult> {
  const pageId = String(formData.get("pageId") ?? "");
  if (!isEditablePageId(pageId)) return { ok: false, message: "Unknown page." };

  const definition = PAGE_CONTENT_DEFINITIONS[pageId];
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  if (!session || !(await canEditPageContent(definition.permissionKey, session, userId))) {
    return { ok: false, message: "You do not have permission to edit public pages." };
  }
  const panelId = String(formData.get("panelId") ?? "");
  const panel = definition.panels.find((item) => item.id === panelId);
  if (!panel) return { ok: false, message: "Unknown content panel." };

  const panelContent: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const item of panel.fields) {
    const value = String(formData.get(item.key) ?? "").trim();
    if (!value) errors[item.key] = `${item.label} is required.`;
    else if (value.length > (item.maxLength ?? 600)) errors[item.key] = `${item.label} is too long.`;
    panelContent[item.key] = value;
  }
  if (Object.keys(errors).length) return { ok: false, message: "Please correct the highlighted fields.", errors };

  const db = getDb();
  if (!db) return { ok: false, message: "Unable to save — the service connection is unavailable." };
  try {
    // Read inside the try: a failure here must abort the save, not merge this
    // panel over a defaults-shaped `before` and wipe the other panels' copy.
    const before = await readPageContentForUpdate(pageId);
    const next = { ...before, ...panelContent };
    await updatePageContent(pageId, next);
    const settingKey = `${PAGE_CONTENT_SETTING_PREFIX}${pageId}`;
    await db.insert(schema.auditLogs).values({
      action: `${settingKey}.update`, targetType: "setting", targetId: settingKey,
      metadata: { before, after: next, panelId, fields: panel.fields.map((item) => item.key), by: session.username },
    });
    revalidatePath(definition.path);
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${pageId}`);
    return { ok: true, message: `${panel.title} published.`, content: panelContent };
  } catch (error) {
    console.error("Failed to update page content", error);
    return { ok: false, message: "The page could not be saved. Please try again." };
  }
}
