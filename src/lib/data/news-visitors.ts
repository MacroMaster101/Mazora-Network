import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

const NEWS_VISITOR_KEY = "news_page_visitors";
const NEWS_ARTICLE_READ_PREFIX = "news_article_reads:";

function asCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }
  return 0;
}

export async function getNewsVisitorCount(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const [row] = await db.select({ value: schema.siteSettings.settingValue }).from(schema.siteSettings).where(eq(schema.siteSettings.settingKey, NEWS_VISITOR_KEY)).limit(1);
    return asCount(row?.value);
  } catch (error) {
    console.error("Failed to load news visitor count:", error);
    return 0;
  }
}

export async function incrementNewsVisitorCount(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const [row] = await db.insert(schema.siteSettings).values({ settingKey: NEWS_VISITOR_KEY, settingValue: 1 }).onConflictDoUpdate({
      target: schema.siteSettings.settingKey,
      set: {
        settingValue: sql`to_jsonb(coalesce(nullif(${schema.siteSettings.settingValue} #>> '{}', '')::bigint, 0) + 1)`,
        updatedAt: new Date(),
      },
    }).returning({ value: schema.siteSettings.settingValue });
    return asCount(row?.value);
  } catch (error) {
    console.error("Failed to increment news visitor count:", error);
    return getNewsVisitorCount();
  }
}

function articleReadKey(slug: string): string {
  return `${NEWS_ARTICLE_READ_PREFIX}${slug}`;
}

export async function getNewsArticleReadCount(slug: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, articleReadKey(slug)))
      .limit(1);
    return asCount(row?.value);
  } catch (error) {
    console.error(`Failed to load read count for news article "${slug}":`, error);
    return 0;
  }
}

export async function incrementNewsArticleReadCount(slug: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const settingKey = articleReadKey(slug);
  try {
    const [row] = await db
      .insert(schema.siteSettings)
      .values({ settingKey, settingValue: 1 })
      .onConflictDoUpdate({
        target: schema.siteSettings.settingKey,
        set: {
          settingValue: sql`to_jsonb(coalesce(nullif(${schema.siteSettings.settingValue} #>> '{}', '')::bigint, 0) + 1)`,
          updatedAt: new Date(),
        },
      })
      .returning({ value: schema.siteSettings.settingValue });
    return asCount(row?.value);
  } catch (error) {
    console.error(`Failed to increment read count for news article "${slug}":`, error);
    return getNewsArticleReadCount(slug);
  }
}
