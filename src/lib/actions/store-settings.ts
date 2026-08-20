"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageStore } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { getAdminGameModes, getAdminProducts, getProducts } from "@/lib/data/content";
import { categoryConfigId, getStoreCategoryConfigs, getStoreCategorySettingState, STORE_CATEGORY_CONFIG_KEY } from "@/lib/data/store-categories";
import {
  getStoreFeaturedSlugs,
  getStoreRoadmap,
  getStoreWelcomeBanner,
  STORE_FEATURED_PICKS_KEY,
  STORE_ROADMAP_KEY,
  STORE_WELCOME_BANNER_KEY,
} from "@/lib/data/store-settings";

export interface StoreSettingsActionResult {
  ok: boolean;
  message: string;
}

async function storeEditor() {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  return session && (await canManageStore(session, userId)) ? session : null;
}

export async function saveStoreFeaturedPicksAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) {
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
  revalidatePath("/admin/store/content");
  return { ok: true, message: "Store featured picks updated." };
}

const welcomeBannerSchema = z.object({
  badge: z.string().trim().min(2, "Enter a badge text.").max(120),
  title: z.string().trim().min(2, "Enter a banner title.").max(140),
  paragraph1: z.string().trim().min(10, "Add paragraph 1 content.").max(2000),
  paragraph2: z.string().trim().min(10, "Add paragraph 2 content.").max(2000),
  supportNote: z.string().trim().min(10, "Add support note content.").max(1500),
  imageUrl: z.string().trim().min(1, "Enter an image URL.").max(500),
  enabled: z.boolean(),
});

export async function saveStoreWelcomeBannerAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) {
    return { ok: false, message: "You do not have permission to manage Store welcome banner." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const parsed = welcomeBannerSchema.safeParse({
    badge: formData.get("badge"),
    title: formData.get("title"),
    paragraph1: formData.get("paragraph1"),
    paragraph2: formData.get("paragraph2"),
    supportNote: formData.get("supportNote"),
    imageUrl: formData.get("imageUrl"),
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check welcome banner fields." };
  }

  const before = await getStoreWelcomeBanner();
  await db
    .insert(schema.siteSettings)
    .values({ settingKey: STORE_WELCOME_BANNER_KEY, settingValue: parsed.data })
    .onConflictDoUpdate({
      target: schema.siteSettings.settingKey,
      set: { settingValue: parsed.data, updatedAt: new Date() },
    });

  await db.insert(schema.auditLogs).values({
    action: "store.welcome_banner.update",
    targetType: "setting",
    targetId: STORE_WELCOME_BANNER_KEY,
    metadata: { before, after: parsed.data, by: session.username },
  });

  revalidatePath("/store");
  revalidatePath("/admin/store");
  revalidatePath("/admin/store/content");
  return { ok: true, message: "Store welcome banner updated." };
}

const roadmapItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2, "Enter feature title.").max(100),
  desc: z.string().trim().max(300).default(""),
  status: z.string().trim().min(1).max(50),
  icon: z.string().trim().min(1).max(50).default("package"),
  enabled: z.boolean().default(true),
});

const roadmapSchema = z.object({
  eyebrow: z.string().trim().min(2, "Enter section eyebrow.").max(80),
  title: z.string().trim().min(2, "Enter section title.").max(120),
  subtitle: z.string().trim().max(500).default(""),
  enabled: z.boolean().default(true),
  items: z.array(roadmapItemSchema),
});

export async function saveStoreRoadmapAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) {
    return { ok: false, message: "You do not have permission to manage Store roadmap." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const rawJson = formData.get("roadmapJson");
  if (typeof rawJson !== "string") {
    return { ok: false, message: "Invalid roadmap data submitted." };
  }

  try {
    const parsedData = JSON.parse(rawJson);
    const parsed = roadmapSchema.safeParse(parsedData);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Check roadmap fields." };
    }

    const before = await getStoreRoadmap();
    await db
      .insert(schema.siteSettings)
      .values({ settingKey: STORE_ROADMAP_KEY, settingValue: parsed.data })
      .onConflictDoUpdate({
        target: schema.siteSettings.settingKey,
        set: { settingValue: parsed.data, updatedAt: new Date() },
      });

    await db.insert(schema.auditLogs).values({
      action: "store.roadmap.update",
      targetType: "setting",
      targetId: STORE_ROADMAP_KEY,
      metadata: { before, after: parsed.data, by: session.username },
    });

    revalidatePath("/store");
    revalidatePath("/admin/store");
    revalidatePath("/admin/store/content");
    return { ok: true, message: "Store marketplace roadmap updated." };
  } catch {
    return { ok: false, message: "Failed to parse roadmap configuration." };
  }
}

const storeCategorySchema = z.object({
  gameModeSlug: z.string().trim().min(1).max(100),
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(2, "Enter a category display name.").max(60),
  eyebrow: z.string().trim().min(1, "Enter a category label.").max(60),
  description: z.string().trim().min(3, "Add a category description.").max(500),
  accent: z.enum(["green", "gold", "cyan", "rose", "violet", "orange"]).default("violet"),
  sortOrder: z.coerce.number().int().min(-10000).max(10000).default(0),
  icon: z.string().trim().default("Gem"),
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
  icon: z.string().trim().min(1).max(60).default("Layers"),
  enabled: z.boolean(),
});

function refreshCategoryPaths(modeSlug: string) {
  revalidatePath("/store");
  revalidatePath("/admin/store");
  revalidatePath("/admin/store/catalog");
  revalidatePath(`/admin/store/catalog/${modeSlug}`);
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
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage Store categories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const gameModeSlug = String(formData.get("gameModeSlug") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const rawKey = String(formData.get("key") ?? "").trim();
  const key = rawKey.length > 0 ? rawKey : label;
  const eyebrow = String(formData.get("eyebrow") ?? "").trim() || "Collection";
  const icon = String(formData.get("icon") ?? "").trim() || "Gem";
  const accent = String(formData.get("accent") ?? "").trim() || "violet";
  const sortOrder = formData.get("sortOrder") !== null && formData.get("sortOrder") !== "" ? Number(formData.get("sortOrder")) : 0;

  const hasUseSubcategoriesInForm = formData.has("useSubcategories");
  const formUseSubcategories = formData.get("useSubcategories") === "on" || formData.get("useSubcategories") === "true";

  const modes = await getAdminGameModes();
  if (!modes.some((mode) => mode.slug === gameModeSlug)) return { ok: false, message: "That game mode no longer exists." };
  const [before, state] = await Promise.all([getStoreCategoryConfigs(modes), getStoreCategorySettingState()]);
  const id = categoryConfigId(gameModeSlug, key);
  const previous = before.find((item) => categoryConfigId(item.gameModeSlug, item.key) === id);

  const resolvedUseSubcategories = hasUseSubcategoriesInForm ? formUseSubcategories : (previous?.useSubcategories ?? false);

  const parsed = storeCategorySchema.safeParse({
    gameModeSlug,
    key,
    label,
    eyebrow,
    description: formData.get("description"),
    accent,
    sortOrder,
    icon,
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    useSubcategories: resolvedUseSubcategories,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the category fields." };

  const nextCategory = { ...parsed.data, subcategories: previous?.subcategories ?? [] };
  await persistCategoryState(withCategoryOverride(state, nextCategory));
  await db.insert(schema.auditLogs).values({ action: previous ? "store.category.update" : "store.category.create", targetType: "setting", targetId: id, metadata: { before: previous ?? null, after: nextCategory, by: session.username } });
  refreshCategoryPaths(parsed.data.gameModeSlug);
  return { ok: true, message: previous ? `${parsed.data.label} category updated.` : `${parsed.data.label} category created.` };
}

export async function reorderStoreCategoriesAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to reorder Store categories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const gameModeSlug = String(formData.get("gameModeSlug") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim() as "up" | "down" | "drag";
  const rawTarget = formData.get("targetIndex");

  if (!gameModeSlug || !key) {
    return { ok: false, message: "Invalid reorder parameters." };
  }

  const modes = await getAdminGameModes();
  const configs = await getStoreCategoryConfigs(modes);
  const modeCategories = configs
    .filter((item) => item.gameModeSlug === gameModeSlug)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const index = modeCategories.findIndex((item) => item.key === key);
  if (index === -1) return { ok: false, message: "Category not found." };

  let targetIndex = direction === "up" ? index - 1 : index + 1;
  if (direction === "drag" && rawTarget !== null && rawTarget !== undefined) {
    targetIndex = Number(rawTarget);
  }

  if (targetIndex < 0 || targetIndex >= modeCategories.length || targetIndex === index) {
    return { ok: true, message: "Category is already at the position." };
  }

  const reordered = [...modeCategories];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);

  const updatedCategories = reordered.map((cat, i) => ({ ...cat, sortOrder: i * 10 }));

  const state = await getStoreCategorySettingState();
  let updatedState = { ...state };
  for (const cat of updatedCategories) {
    updatedState = withCategoryOverride(updatedState, cat);
  }

  await persistCategoryState(updatedState);
  refreshCategoryPaths(gameModeSlug);
  return { ok: true, message: "Category order updated." };
}

export async function toggleStoreCategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to toggle Store categories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const gameModeSlug = String(formData.get("gameModeSlug") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const enabled = formData.get("enabled") === "true" || formData.get("enabled") === "on";

  if (!gameModeSlug || !key) {
    return { ok: false, message: "Invalid category parameters." };
  }

  const modes = await getAdminGameModes();
  const configs = await getStoreCategoryConfigs(modes);
  const category = configs.find((item) => item.gameModeSlug === gameModeSlug && item.key === key);
  if (!category) return { ok: false, message: "That category no longer exists." };

  const updatedCategory = { ...category, enabled };
  const state = await getStoreCategorySettingState();
  await persistCategoryState(withCategoryOverride(state, updatedCategory));
  await db.insert(schema.auditLogs).values({
    action: "store.category.toggle",
    targetType: "setting",
    targetId: categoryConfigId(gameModeSlug, key),
    metadata: { before: category, after: updatedCategory, by: session.username },
  });

  refreshCategoryPaths(gameModeSlug);
  return { ok: true, message: enabled ? `${category.label} category enabled.` : `${category.label} category hidden.` };
}

export async function toggleStoreCategorySubcategoriesAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage Store subcategories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const gameModeSlug = String(formData.get("gameModeSlug") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const useSubcategories = formData.get("useSubcategories") === "true" || formData.get("useSubcategories") === "on";

  if (!gameModeSlug || !key) {
    return { ok: false, message: "Invalid category parameters." };
  }

  const modes = await getAdminGameModes();
  const configs = await getStoreCategoryConfigs(modes);
  const category = configs.find((item) => item.gameModeSlug === gameModeSlug && item.key === key);
  if (!category) return { ok: false, message: "That category no longer exists." };

  const updatedCategory = { ...category, useSubcategories };
  const state = await getStoreCategorySettingState();
  await persistCategoryState(withCategoryOverride(state, updatedCategory));
  await db.insert(schema.auditLogs).values({
    action: "store.category.use_subcategories.toggle",
    targetType: "setting",
    targetId: categoryConfigId(gameModeSlug, key),
    metadata: { before: category, after: updatedCategory, by: session.username },
  });

  refreshCategoryPaths(gameModeSlug);
  return { ok: true, message: useSubcategories ? `${category.label} subcategories enabled.` : `${category.label} subcategories disabled.` };
}

export async function deleteStoreCategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to delete Store categories." };
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
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage Store subcategories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const gameModeSlug = String(formData.get("gameModeSlug") ?? "").trim();
  const categoryKey = String(formData.get("categoryKey") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const rawKey = String(formData.get("key") ?? "").trim();
  const modes = await getAdminGameModes();
  const configs = await getStoreCategoryConfigs(modes);
  const category = configs.find((item) => item.gameModeSlug === gameModeSlug && item.key === categoryKey);
  if (!category) return { ok: false, message: "That category no longer exists." };
  const key = rawKey || label;
  const previous = category.subcategories.find((item) => item.key === key);
  if (!rawKey && previous) return { ok: false, message: "A subcategory with that name already exists." };
  const nextSortOrder = previous?.sortOrder ?? (category.subcategories.reduce((highest, item) => Math.max(highest, item.sortOrder), -10) + 10);
  const parsed = storeSubcategorySchema.safeParse({
    gameModeSlug,
    categoryKey,
    key,
    label,
    description: formData.get("description"),
    sortOrder: nextSortOrder,
    icon: formData.get("icon"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the subcategory fields." };
  const nextSubcategory = { key: parsed.data.key, label: parsed.data.label, description: parsed.data.description, sortOrder: parsed.data.sortOrder, enabled: parsed.data.enabled, icon: parsed.data.icon };
  const nextCategory = { ...category, useSubcategories: true, subcategories: [...category.subcategories.filter((item) => item.key !== parsed.data.key), nextSubcategory].sort((a, b) => a.sortOrder - b.sortOrder) };
  const state = await getStoreCategorySettingState();
  await persistCategoryState(withCategoryOverride(state, nextCategory));
  const targetId = `${categoryConfigId(category.gameModeSlug, category.key)}:${parsed.data.key}`;
  await db.insert(schema.auditLogs).values({ action: previous ? "store.subcategory.update" : "store.subcategory.create", targetType: "setting", targetId, metadata: { before: previous ?? null, after: nextSubcategory, by: session.username } });
  refreshCategoryPaths(category.gameModeSlug);
  return { ok: true, message: previous ? `${parsed.data.label} updated.` : `${parsed.data.label} created.` };
}

export async function toggleStoreSubcategoryAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage Store subcategories." };
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
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to delete Store subcategories." };
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

export async function reorderStoreSubcategoriesAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to reorder Store subcategories." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const gameModeSlug = String(formData.get("gameModeSlug") ?? "").trim();
  const categoryKey = String(formData.get("categoryKey") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim() as "up" | "down" | "drag";
  const rawTarget = formData.get("targetIndex");

  if (!gameModeSlug || !categoryKey || !key) {
    return { ok: false, message: "Invalid reorder parameters." };
  }

  const modes = await getAdminGameModes();
  const configs = await getStoreCategoryConfigs(modes);
  const category = configs.find((item) => item.gameModeSlug === gameModeSlug && item.key === categoryKey);
  if (!category) return { ok: false, message: "Category not found." };

  const subcategories = [...category.subcategories].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = subcategories.findIndex((item) => item.key === key);
  if (index === -1) return { ok: false, message: "Subcategory not found." };

  let targetIndex = direction === "up" ? index - 1 : index + 1;
  if (direction === "drag" && rawTarget !== null && rawTarget !== undefined) {
    targetIndex = Number(rawTarget);
  }

  if (targetIndex < 0 || targetIndex >= subcategories.length || targetIndex === index) {
    return { ok: true, message: "Subcategory is already at the position." };
  }

  const reordered = [...subcategories];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);

  const updatedSubcategories = reordered.map((sub, i) => ({ ...sub, sortOrder: i * 10 }));

  const updatedCategory = { ...category, subcategories: updatedSubcategories };
  const state = await getStoreCategorySettingState();
  await persistCategoryState(withCategoryOverride(state, updatedCategory));

  refreshCategoryPaths(gameModeSlug);
  return { ok: true, message: "Subcategory order updated." };
}
