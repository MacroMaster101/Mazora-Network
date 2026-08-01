import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export const STORE_FEATURED_PICKS_KEY = "store.featured_picks";
export const DEFAULT_STORE_FEATURED_SLUGS = [
  "battlepass-premium",
  "key-legendary-1",
  "rank-conqueror-permanent",
];

export async function getStoreFeaturedSlugs(): Promise<string[]> {
  const db = getDb();
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
  } catch (error) {
    console.error("Failed to load Store featured picks:", error);
    return DEFAULT_STORE_FEATURED_SLUGS;
  }
}
