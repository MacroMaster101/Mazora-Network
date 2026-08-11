import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { GameMode, StoreCategoryConfig, StoreSubcategoryConfig } from "@/lib/types";

export const STORE_CATEGORY_CONFIG_KEY = "store.category_config";
export const STORE_CATEGORY_KEYS = ["Ranks", "Crate Keys", "Battlepass", "Add-ons"] as const;

export interface StoreCategorySettingState {
  categories: StoreCategoryConfig[];
  deletedIds: string[];
}

const rankSubcategories: StoreSubcategoryConfig[] = [
  { key: "Monthly", label: "Monthly Ranks", description: "Recurring supporter ranks billed monthly.", sortOrder: 0, enabled: true, icon: "Clock3" },
  { key: "Permanent", label: "Permanent Ranks", description: "One-time permanent supporter ranks.", sortOrder: 10, enabled: true, icon: "Crown" },
];

const addonSubcategories: StoreSubcategoryConfig[] = [
  { key: "XP Boosts", label: "XP Boosts", description: "Experience boosts for faster progression.", sortOrder: 0, enabled: true, icon: "Activity" },
  { key: "Claim Blocks", label: "Claim Blocks", description: "Additional land protection capacity.", sortOrder: 10, enabled: true, icon: "Shield" },
  { key: "Player Points", label: "Player Points", description: "Points for the in-game rewards economy.", sortOrder: 20, enabled: true, icon: "Coins" },
];

const SUBCATEGORY_ICONS: Record<string, string> = {
  Monthly: "Clock3",
  Permanent: "Crown",
  "XP Boosts": "Activity",
  "Claim Blocks": "Shield",
  "Player Points": "Coins",
};

const DEFAULTS: Record<(typeof STORE_CATEGORY_KEYS)[number], Omit<StoreCategoryConfig, "gameModeSlug" | "key">> = {
  Ranks: { label: "Ranks", eyebrow: "Progression", description: "Monthly support or a permanent place in the server hierarchy.", accent: "violet", sortOrder: 0, enabled: true, useSubcategories: true, subcategories: rankSubcategories, icon: "Crown" },
  "Crate Keys": { label: "Crate Keys", eyebrow: "Rewards", description: "Curated reward pools ranging from useful boosts to legendary drops.", accent: "gold", sortOrder: 10, enabled: true, useSubcategories: false, subcategories: [], icon: "Gem" },
  Battlepass: { label: "Battlepass", eyebrow: "Seasonal", description: "Season access, missions, and collectible rewards.", accent: "rose", sortOrder: 20, enabled: true, useSubcategories: false, subcategories: [], icon: "Sparkles" },
  "Add-ons": { label: "Add-ons", eyebrow: "Utility", description: "Progression boosts and convenience upgrades for this game mode.", accent: "cyan", sortOrder: 30, enabled: true, useSubcategories: true, subcategories: addonSubcategories, icon: "Layers" },
};

export function categoryConfigId(gameModeSlug: string, key: string): string {
  return `${gameModeSlug}:${key}`;
}

export function defaultStoreCategories(modes: GameMode[]): StoreCategoryConfig[] {
  return modes.flatMap((mode) => STORE_CATEGORY_KEYS.map((key) => ({ gameModeSlug: mode.slug, key, ...DEFAULTS[key], subcategories: DEFAULTS[key].subcategories.map((item) => ({ ...item })) })));
}

function isSubcategoryConfig(value: unknown): value is StoreSubcategoryConfig {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoreSubcategoryConfig>;
  return typeof item.key === "string" && item.key.trim().length >= 1 && typeof item.label === "string" && typeof item.description === "string" && typeof item.sortOrder === "number" && typeof item.enabled === "boolean";
}

function normalizeCategoryConfig(value: unknown): StoreCategoryConfig | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StoreCategoryConfig>;
  if (typeof item.gameModeSlug !== "string" || typeof item.key !== "string" || item.key.trim().length < 1 || typeof item.label !== "string") return null;
  const defaultIcon = DEFAULTS[item.key as keyof typeof DEFAULTS]?.icon ?? "Gem";
  const subcategories = Array.isArray(item.subcategories)
    ? item.subcategories.filter(isSubcategoryConfig).map((subcategory) => ({ ...subcategory, icon: subcategory.icon ?? SUBCATEGORY_ICONS[subcategory.key] ?? defaultIcon }))
    : [];
  const useSubcategories = item.useSubcategories ?? subcategories.length > 0;
  return {
    ...item,
    eyebrow: item.eyebrow ?? "Collection",
    description: item.description ?? "Store products for this game mode.",
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
    enabled: typeof item.enabled === "boolean" ? item.enabled : true,
    accent: item.accent ?? "violet",
    useSubcategories,
    icon: item.icon ?? defaultIcon,
    subcategories,
  } as StoreCategoryConfig;
}

export function parseStoreCategorySetting(value: unknown): StoreCategorySettingState {
  const normalize = (items: unknown[]) => items.map(normalizeCategoryConfig).filter((item): item is StoreCategoryConfig => Boolean(item));
  if (Array.isArray(value)) return { categories: normalize(value), deletedIds: [] };
  if (!value || typeof value !== "object") return { categories: [], deletedIds: [] };
  const record = value as { categories?: unknown; deletedIds?: unknown };
  return {
    categories: Array.isArray(record.categories) ? normalize(record.categories) : [],
    deletedIds: Array.isArray(record.deletedIds) ? record.deletedIds.filter((item): item is string => typeof item === "string") : [],
  };
}

export async function getStoreCategorySettingState(): Promise<StoreCategorySettingState> {
  const db = getDb();
  if (!db) return { categories: [], deletedIds: [] };
  try {
    const [row] = await db.select({ value: schema.siteSettings.settingValue }).from(schema.siteSettings).where(eq(schema.siteSettings.settingKey, STORE_CATEGORY_CONFIG_KEY)).limit(1);
    return parseStoreCategorySetting(row?.value);
  } catch (error) {
    console.error("Failed to load Store category setting state:", error);
    return { categories: [], deletedIds: [] };
  }
}

export async function getStoreCategoryConfigs(modes: GameMode[]): Promise<StoreCategoryConfig[]> {
  const defaults = defaultStoreCategories(modes);
  const state = await getStoreCategorySettingState();
  const deleted = new Set(state.deletedIds);
  const savedById = new Map(state.categories.map((item) => [categoryConfigId(item.gameModeSlug, item.key), item]));
  const defaultIds = new Set(defaults.map((item) => categoryConfigId(item.gameModeSlug, item.key)));
  const mergedDefaults = defaults
    .filter((fallback) => !deleted.has(categoryConfigId(fallback.gameModeSlug, fallback.key)))
    .map((fallback) => {
      const saved = savedById.get(categoryConfigId(fallback.gameModeSlug, fallback.key));
      if (!saved) return fallback;
      const inheritSubcategories = fallback.useSubcategories && !saved.useSubcategories && saved.subcategories.length === 0;
      return {
        ...fallback,
        ...saved,
        useSubcategories: inheritSubcategories ? true : saved.useSubcategories,
        subcategories: inheritSubcategories ? fallback.subcategories : saved.subcategories,
      };
    });
  const custom = state.categories.filter((item) => !defaultIds.has(categoryConfigId(item.gameModeSlug, item.key)) && !deleted.has(categoryConfigId(item.gameModeSlug, item.key)) && modes.some((mode) => mode.slug === item.gameModeSlug));
  return [...mergedDefaults, ...custom];
}

export function storeCategorySlug(key: string): string {
  return key.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}


