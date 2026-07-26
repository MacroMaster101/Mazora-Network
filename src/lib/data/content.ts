/**
 * Content repositories. Pages import ONLY from here (and players/status), never
 * the database driver directly, so the data source stays a single swappable seam.
 *
 * The demo fixtures are gone. Anything not yet backed by real rows returns an
 * empty list and the page says so plainly — a page must never invent content it
 * does not have. Today the store and vote sites read from the database; the
 * remaining sections fill in as their tables are populated.
 */
import { asc, eq } from "drizzle-orm";
import type {
  EventItem,
  GalleryImage,
  GameMode,
  NewsArticle,
  Product,
  RuleCategory,
  StaffMember,
  VoteSite,
  TopVoter,
} from "@/lib/types";
import { getDb, schema } from "@/lib/db/client";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ *
 * Store — backed by the products table (see scripts/seed-store.ts).
 * ------------------------------------------------------------------ */

type ProductRow = typeof schema.products.$inferSelect;

function toProduct(row: ProductRow): Product {
  return {
    slug: row.slug,
    name: row.name,
    imageUrl: row.imageUrl ?? undefined,
    category: row.category as Product["category"],
    description: row.description ?? "",
    price: Number(row.price),
    salePrice: row.salePrice != null ? Number(row.salePrice) : undefined,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    accent: (row.accent ?? "violet") as Product["accent"],
    badge: row.badge ?? undefined,
    family: row.family ?? undefined,
    billing: (row.billing ?? undefined) as Product["billing"],
    subcategory: (row.subcategory ?? undefined) as Product["subcategory"],
  };
}

export async function getProducts(): Promise<Product[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.enabled, true))
      .orderBy(asc(schema.products.sortOrder));
    return rows.map(toProduct);
  } catch (error) {
    console.error("Failed to load products:", error);
    return [];
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1);
    return row && row.enabled ? toProduct(row) : null;
  } catch (error) {
    console.error("Failed to load product:", error);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Voting — vote sites live in the database; standings come from votes.
 * ------------------------------------------------------------------ */

export async function getVoteSites(): Promise<VoteSite[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(schema.voteSites).where(eq(schema.voteSites.enabled, true));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      reward: r.rewardDescription || "",
      cooldownHours: r.cooldownHours,
    }));
  } catch (error) {
    console.error("Failed to load vote sites:", error);
    return [];
  }
}

export async function getTopVoters(): Promise<TopVoter[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        username: sql<string>`coalesce(${schema.minecraftAccounts.minecraftUsername}, ${schema.profiles.username}, 'Unknown')`,
        dailyVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= now() - interval '24 hours' then 1 end) as integer)`,
        weeklyVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= now() - interval '7 days' then 1 end) as integer)`,
        monthlyVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= date_trunc('month', now()) then 1 end) as integer)`,
        lastMonthVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= date_trunc('month', now() - interval '1 month') and ${schema.voteHistory.votedAt} < date_trunc('month', now()) then 1 end) as integer)`,
        allTimeVotes: sql<number>`cast(count(*) as integer)`,
      })
      .from(schema.voteHistory)
      .leftJoin(schema.profiles, eq(schema.voteHistory.userId, schema.profiles.userId))
      .leftJoin(schema.minecraftAccounts, eq(schema.voteHistory.userId, schema.minecraftAccounts.userId))
      .groupBy(schema.voteHistory.userId, schema.profiles.username, schema.minecraftAccounts.minecraftUsername);

    return rows;
  } catch (error) {
    console.error("Failed to query top voters from database:", error);
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Not yet backed by real content. These return nothing on purpose: the
 * pages render an explicit empty state rather than placeholder copy.
 * ------------------------------------------------------------------ */

export async function getGameModes(): Promise<GameMode[]> {
  return [];
}
export async function getGameMode(_slug: string): Promise<GameMode | null> {
  return null;
}

export async function getNews(): Promise<NewsArticle[]> {
  return [];
}
export async function getArticle(_slug: string): Promise<NewsArticle | null> {
  return null;
}
export async function getRelatedArticles(_slug: string, _category: string): Promise<NewsArticle[]> {
  return [];
}

export async function getEvents(): Promise<EventItem[]> {
  return [];
}
export async function getEvent(_slug: string): Promise<EventItem | null> {
  return null;
}

/**
 * The community rulebook, edited by staff at /admin/rules. Categories keep their
 * own updated stamp (bumped by a trigger when their rules change), so the public
 * "last updated" date reflects real edits.
 */
export async function getRules(): Promise<RuleCategory[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const [categories, allRules] = await Promise.all([
      db.select().from(schema.ruleCategories).orderBy(asc(schema.ruleCategories.sortOrder)),
      db
        .select()
        .from(schema.rules)
        .where(eq(schema.rules.enabled, true))
        .orderBy(asc(schema.rules.sortOrder)),
    ]);

    return categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon ?? "Shield",
      updated: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
      items: allRules
        .filter((r) => r.categoryId === c.id)
        .map((r) => ({ title: r.title, body: r.description ?? "" })),
    }));
  } catch (error) {
    console.error("Failed to load rules:", error);
    return [];
  }
}

export async function getStaff(): Promise<StaffMember[]> {
  return [];
}

export async function getGallery(): Promise<GalleryImage[]> {
  return [];
}
