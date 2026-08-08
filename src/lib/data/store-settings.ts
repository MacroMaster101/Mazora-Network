import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export const STORE_FEATURED_PICKS_KEY = "store.featured_picks";
export const DEFAULT_STORE_FEATURED_SLUGS = [
  "battlepass-premium",
  "key-legendary-1",
  "rank-conqueror-permanent",
];

export async function getStoreFeaturedSlugs(): Promise<string[]> {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return DEFAULT_STORE_FEATURED_SLUGS;
  }
  if (!db) return DEFAULT_STORE_FEATURED_SLUGS;

  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_FEATURED_PICKS_KEY))
      .limit(1);
    const value = row?.value;
    if (!Array.isArray(value)) return DEFAULT_STORE_FEATURED_SLUGS;
    const slugs = value.filter((slug): slug is string => typeof slug === "string").slice(0, 3);
    return slugs.length === 3 ? slugs : DEFAULT_STORE_FEATURED_SLUGS;
  } catch {
    /* DB may not have this table/key yet — fall back silently */
    return DEFAULT_STORE_FEATURED_SLUGS;
  }
}

import {
  DEFAULT_STORE_ROADMAP,
  DEFAULT_STORE_WELCOME_BANNER,
  type StoreRoadmapConfig,
  type StoreRoadmapItem,
  type StoreWelcomeBannerConfig,
} from "@/lib/types";

export { DEFAULT_STORE_ROADMAP, DEFAULT_STORE_WELCOME_BANNER, type StoreRoadmapConfig, type StoreRoadmapItem, type StoreWelcomeBannerConfig };
export const STORE_WELCOME_BANNER_KEY = "store.welcome_banner";
export const STORE_ROADMAP_KEY = "store.roadmap";

export async function getStoreWelcomeBanner(): Promise<StoreWelcomeBannerConfig> {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return DEFAULT_STORE_WELCOME_BANNER;
  }
  if (!db) return DEFAULT_STORE_WELCOME_BANNER;

  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_WELCOME_BANNER_KEY))
      .limit(1);
    if (!row?.value || typeof row.value !== "object") return DEFAULT_STORE_WELCOME_BANNER;
    const v = row.value as Record<string, unknown>;
    return {
      badge: typeof v.badge === "string" ? v.badge : DEFAULT_STORE_WELCOME_BANNER.badge,
      title: typeof v.title === "string" ? v.title : DEFAULT_STORE_WELCOME_BANNER.title,
      paragraph1: typeof v.paragraph1 === "string" ? v.paragraph1 : DEFAULT_STORE_WELCOME_BANNER.paragraph1,
      paragraph2: typeof v.paragraph2 === "string" ? v.paragraph2 : DEFAULT_STORE_WELCOME_BANNER.paragraph2,
      supportNote: typeof v.supportNote === "string" ? v.supportNote : DEFAULT_STORE_WELCOME_BANNER.supportNote,
      imageUrl: typeof v.imageUrl === "string" && v.imageUrl.trim() ? v.imageUrl : DEFAULT_STORE_WELCOME_BANNER.imageUrl,
      enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_STORE_WELCOME_BANNER.enabled,
    };
  } catch {
    /* DB may not have this table/key yet — fall back silently */
    return DEFAULT_STORE_WELCOME_BANNER;
  }
}

export async function getStoreRoadmap(): Promise<StoreRoadmapConfig> {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return DEFAULT_STORE_ROADMAP;
  }
  if (!db) return DEFAULT_STORE_ROADMAP;

  try {
    const rows = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_ROADMAP_KEY))
      .limit(1);
    const row = rows[0];
    if (!row?.value || typeof row.value !== "object") return DEFAULT_STORE_ROADMAP;
    const v = row.value as Record<string, unknown>;
    const rawItems = Array.isArray(v.items) ? v.items : DEFAULT_STORE_ROADMAP.items;
    const items: StoreRoadmapItem[] = rawItems
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item, idx) => ({
        id: typeof item.id === "string" ? item.id : `roadmap-${idx}`,
        title: typeof item.title === "string" ? item.title : "Upcoming Feature",
        desc: typeof item.desc === "string" ? item.desc : "",
        status: typeof item.status === "string" ? item.status : "Coming Soon",
        icon: typeof item.icon === "string" ? item.icon : "package",
        enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      }));

    return {
      eyebrow: typeof v.eyebrow === "string" ? v.eyebrow : DEFAULT_STORE_ROADMAP.eyebrow,
      title: typeof v.title === "string" ? v.title : DEFAULT_STORE_ROADMAP.title,
      subtitle: typeof v.subtitle === "string" ? v.subtitle : DEFAULT_STORE_ROADMAP.subtitle,
      enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_STORE_ROADMAP.enabled,
      items: items.length > 0 ? items : DEFAULT_STORE_ROADMAP.items,
    };
  } catch {
    /* DB may not have this key yet — fall back silently */
    return DEFAULT_STORE_ROADMAP;
  }
}
