"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, hasAtLeast } from "@/lib/auth";
import { getDb, schema } from "@/lib/db/client";
import { getAdminGameModes, getAdminProducts, getProducts } from "@/lib/data/content";
import { categoryConfigId, getStoreCategoryConfigs, getStoreCategorySettingState, STORE_CATEGORY_CONFIG_KEY } from "@/lib/data/store-categories";
import { getStoreFeaturedSlugs, STORE_FEATURED_PICKS_KEY } from "@/lib/data/store-settings";

export interface StoreSettingsActionResult {
  ok: boolean;
  message: string;
}

export async function saveStoreFeaturedPicksAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) {
    return { ok: false, message: "You do not have permission to manage Store merchandising." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const products = await getProducts();
  const available = new Set(products.map((product) => product.slug));
  const slugs = Array.from(
    new Set(
      formData
        .getAll("featuredSlugs")
        .filter((value): value is string => typeof value === "string")
        .filter((slug) => available.has(slug)),
    ),
  ).slice(0, 3);

  if (slugs.length !== 3) {
    return { ok: false, message: "Choose exactly three enabled products." };
  }

  const before = await getStoreFeaturedSlugs();
  await db
    .insert(schema.siteSettings)
    .values({ settingKey: STORE_FEATURED_PICKS_KEY, settingValue: slugs })
    .onConflictDoUpdate({
      target: schema.siteSettings.settingKey,
      set: { settingValue: slugs, updatedAt: new Date() },
    });

  await db.insert(schema.auditLogs).values({
    action: "store.featured_picks.update",
    targetType: "setting",
    targetId: STORE_FEATURED_PICKS_KEY,
    metadata: { before, after: slugs, by: session.username },
  });

  revalidatePath("/store");
  revalidatePath("/admin/store");
  return { ok: true, message: "Store featured picks updated." };
}

const storeCategorySchema = z.object({
  gameModeSlug: z.string().trim().min(1).max(100),
  key: z.string().trim().min(2, "Enter a category key.").max(60),
  label: z.string().trim().min(2, "Enter a category name.").max(60),
  eyebrow: z.string().trim().min(2, "Enter a short category type.").max(60),
  description: z.string().trim().min(5, "Add a category description.").max(500),
  accent: z.enum(["green", "gold", "cyan", "rose", "violet", "orange"]),
  sortOrder: z.coerce.number().int().min(-10000).max(10000),
  enabled: z.boolean(),
  useSubcategories: z.boolean(),
});

const storeSubcategorySchema = z.object({
  gameModeSlug: z.string().trim().min(1).max(100),
  categoryKey: z.string().trim().min(2).max(60),
  key: z.string().trim().min(1, "Enter a subcategory key.").max(60),
  label: z.string().trim().min(2, "Enter a subcategory name.").max(60),
  description: z.string().trim().min(3, "Add a short description.").max(300),
  sortOrder: z.coerce.number().int().min(-10000).max(10000),
  enabled: z.boolean(),
});

function refreshCategoryPaths(modeSlug: string) {
  revalidatePath("/store");
  revalidatePath("/admin/store");
  revalidatePath(`/admin/store/${modeSlug}`);
}

async function persistCategoryState(state: Awaited<ReturnType<typeof getStoreCategorySettingState>>) {
  const db = getDb();
  if (!db) return false;
  await db
    .insert(schema.siteSettings)
    .values({ settingKey: STORE_CATEGORY_CONFIG_KEY, settingValue: state })
    .onConflictDoUpdate({ target: schema.siteSettings.settingKey, set: { settingValue: state, updatedAt: new Date() } });
  return true;
}

function withCategoryOverride(
  state: Awaited<ReturnType<typeof getStoreCategorySettingState>>,
  category: Awaited<ReturnType<typeof getStoreCategoryConfigs>>[number],
) {
  const id = categoryConfigId(category.gameModeSlug, category.key);
  return {
    categories: [...state.categories.filter((item) => categoryConfigId(item.gameModeSlug, item.key) !== id), category],
    deletedIds: state.deletedIds.filter((item) => item !== id),
  };
}

export async function saveStoreCategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) return { ok: false, message: "You do not have permission to manage Store categories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const parsed = storeCategorySchema.safeParse({
    gameModeSlug: formData.get("gameModeSlug"), key: formData.get("key"), label: formData.get("label"), eyebrow: formData.get("eyebrow"),
    description: formData.get("description"), accent: formData.get("accent"), sortOrder: formData.get("sortOrder"),
    enabled: formData.get("enabled") === "on", useSubcategories: formData.get("useSubcategories") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the category fields." };
  const modes = await getAdminGameModes();
  if (!modes.some((mode) => mode.slug === parsed.data.gameModeSlug)) return { ok: false, message: "That game mode no longer exists." };
  const [before, state] = await Promise.all([getStoreCategoryConfigs(modes), getStoreCategorySettingState()]);
  const id = categoryConfigId(parsed.data.gameModeSlug, parsed.data.key);
  const previous = before.find((item) => categoryConfigId(item.gameModeSlug, item.key) === id);
  const nextCategory = { ...parsed.data, subcategories: previous?.subcategories ?? [] };
  await persistCategoryState(withCategoryOverride(state, nextCategory));
  await db.insert(schema.auditLogs).values({ action: previous ? "store.category.update" : "store.category.create", targetType: "setting", targetId: id, metadata: { before: previous ?? null, after: nextCategory, by: session.username } });
  refreshCategoryPaths(parsed.data.gameModeSlug);
  return { ok: true, message: previous ? `${parsed.data.label} category updated.` : `${parsed.data.label} category created.` };
}

export async function deleteStoreCategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) return { ok: false, message: "You do not have permission to delete Store categories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const gameModeSlug = String(formData.get("gameModeSlug") ?? "");
  const key = String(formData.get("key") ?? "").trim();
  if (key.length < 2 || key.length > 60) return { ok: false, message: "That category is invalid." };
  const products = await getAdminProducts();
  if (products.some((product) => (product.gameModeSlug ?? "survival-smp") === gameModeSlug && product.category === key)) return { ok: false, message: "Delete or move this category's products before deleting the category." };
  const modes = await getAdminGameModes();
  const before = (await getStoreCategoryConfigs(modes)).find((item) => item.gameModeSlug === gameModeSlug && item.key === key);
  if (!before) return { ok: false, message: "That category no longer exists." };
  const state = await getStoreCategorySettingState();
  const id = categoryConfigId(gameModeSlug, key);
  await persistCategoryState({ categories: state.categories.filter((item) => categoryConfigId(item.gameModeSlug, item.key) !== id), deletedIds: Array.from(new Set([...state.deletedIds, id])) });
  await db.insert(schema.auditLogs).values({ action: "store.category.delete", targetType: "setting", targetId: id, metadata: { before, by: session.username } });
  refreshCategoryPaths(gameModeSlug);
  return { ok: true, message: `${before.label} category deleted.` };
}

export async function saveStoreSubcategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) return { ok: false, message: "You do not have permission to manage Store subcategories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const parsed = storeSubcategorySchema.safeParse({
    gameModeSlug: formData.get("gameModeSlug"), categoryKey: formData.get("categoryKey"), key: formData.get("key"),
    label: formData.get("label"), description: formData.get("description"), sortOrder: formData.get("sortOrder"), enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the subcategory fields." };
  const modes = await getAdminGameModes();
  const configs = await getStoreCategoryConfigs(modes);
  const category = configs.find((item) => item.gameModeSlug === parsed.data.gameModeSlug && item.key === parsed.data.categoryKey);
  if (!category) return { ok: false, message: "That category no longer exists." };
  const previous = category.subcategories.find((item) => item.key === parsed.data.key);
  const nextSubcategory = { key: parsed.data.key, label: parsed.data.label, description: parsed.data.description, sortOrder: parsed.data.sortOrder, enabled: parsed.data.enabled };
  const nextCategory = { ...category, useSubcategories: true, subcategories: [...category.subcategories.filter((item) => item.key !== parsed.data.key), nextSubcategory].sort((a, b) => a.sortOrder - b.sortOrder) };
  const state = await getStoreCategorySettingState();
  await persistCategoryState(withCategoryOverride(state, nextCategory));
  const targetId = `${categoryConfigId(category.gameModeSlug, category.key)}:${parsed.data.key}`;
  await db.insert(schema.auditLogs).values({ action: previous ? "store.subcategory.update" : "store.subcategory.create", targetType: "setting", targetId, metadata: { before: previous ?? null, after: nextSubcategory, by: session.username } });
  refreshCategoryPaths(category.gameModeSlug);
  return { ok: true, message: previous ? `${parsed.data.label} updated.` : `${parsed.data.label} created.` };
}

export async function toggleStoreSubcategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) return { ok: false, message: "You do not have permission to manage Store subcategories." };
  const gameModeSlug = String(formData.get("gameModeSlug") ?? "");
  const categoryKey = String(formData.get("categoryKey") ?? "");
  const key = String(formData.get("key") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const modes = await getAdminGameModes();
  const category = (await getStoreCategoryConfigs(modes)).find((item) => item.gameModeSlug === gameModeSlug && item.key === categoryKey);
  const subcategory = category?.subcategories.find((item) => item.key === key);
  if (!category || !subcategory) return { ok: false, message: "That subcategory no longer exists." };
  const nextCategory = { ...category, subcategories: category.subcategories.map((item) => item.key === key ? { ...item, enabled } : item) };
  const state = await getStoreCategorySettingState();
  await persistCategoryState(withCategoryOverride(state, nextCategory));
  refreshCategoryPaths(gameModeSlug);
  return { ok: true, message: enabled ? `${subcategory.label} enabled.` : `${subcategory.label} hidden.` };
}

export async function deleteStoreSubcategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) return { ok: false, message: "You do not have permission to delete Store subcategories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const gameModeSlug = String(formData.get("gameModeSlug") ?? "");
  const categoryKey = String(formData.get("categoryKey") ?? "");
  const key = String(formData.get("key") ?? "");
  const products = await getAdminProducts();
  if (products.some((product) => (product.gameModeSlug ?? "survival-smp") === gameModeSlug && product.category === categoryKey && (product.subcategory ?? product.billing) === key)) return { ok: false, message: "Delete or move this subcategory's products before deleting it." };
  const modes = await getAdminGameModes();
  const category = (await getStoreCategoryConfigs(modes)).find((item) => item.gameModeSlug === gameModeSlug && item.key === categoryKey);
  const before = category?.subcategories.find((item) => item.key === key);
  if (!category || !before) return { ok: false, message: "That subcategory no longer exists." };
  const nextCategory = { ...category, subcategories: category.subcategories.filter((item) => item.key !== key) };
  const state = await getStoreCategorySettingState();
  await persistCategoryState(withCategoryOverride(state, nextCategory));
  await db.insert(schema.auditLogs).values({ action: "store.subcategory.delete", targetType: "setting", targetId: `${categoryConfigId(gameModeSlug, categoryKey)}:${key}`, metadata: { before, by: session.username } });
  refreshCategoryPaths(gameModeSlug);
  return { ok: true, message: `${before.label} deleted.` };
}
