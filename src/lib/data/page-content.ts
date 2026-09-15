import "server-only";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { PAGE_CONTENT_DEFINITIONS, type EditablePageId } from "@/lib/page-content";

export const PAGE_CONTENT_SETTING_PREFIX = "page.content.";

function mergePageContent(pageId: EditablePageId, value: unknown): Record<string, string> {
  const defaults = PAGE_CONTENT_DEFINITIONS[pageId].defaults;
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...defaults };
  const stored = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof stored[key] === "string" ? stored[key] as string : fallback]));
}

export async function getPageContent(pageId: EditablePageId): Promise<Record<string, string>> {
  try {
    const db = getDb();
    if (!db) return { ...PAGE_CONTENT_DEFINITIONS[pageId].defaults };
    const [row] = await db.select({ value: schema.siteSettings.settingValue }).from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, `${PAGE_CONTENT_SETTING_PREFIX}${pageId}`)).limit(1);
    return mergePageContent(pageId, row?.value);
  } catch {
    return { ...PAGE_CONTENT_DEFINITIONS[pageId].defaults };
  }
}

/**
 * The stored copy, propagating a read failure instead of masking it.
 *
 * `getPageContent` falls back to defaults so a page still renders during a
 * database blip — correct for reading. The save path cannot borrow that: it
 * merges the panel being published over everything already stored, so defaults
 * standing in for a failed read would republish every *other* panel at its
 * default text and silently discard live copy. Rendering may degrade; writing
 * must refuse.
 */
export async function readPageContentForUpdate(pageId: EditablePageId): Promise<Record<string, string>> {
  const db = getDb();
  if (!db) throw new Error("The database is not connected.");
  const [row] = await db.select({ value: schema.siteSettings.settingValue }).from(schema.siteSettings)
    .where(eq(schema.siteSettings.settingKey, `${PAGE_CONTENT_SETTING_PREFIX}${pageId}`)).limit(1);
  return mergePageContent(pageId, row?.value);
}

export async function updatePageContent(pageId: EditablePageId, content: Record<string, string>): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("The database is not connected.");
  const settingKey = `${PAGE_CONTENT_SETTING_PREFIX}${pageId}`;
  await db.insert(schema.siteSettings).values({ settingKey, settingValue: content }).onConflictDoUpdate({
    target: schema.siteSettings.settingKey,
    set: { settingValue: content, updatedAt: new Date() },
  });
}
