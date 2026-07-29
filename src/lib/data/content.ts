/**
 * Content repositories. Pages import ONLY from here (and players/status), never
 * the database driver directly, so the data source stays a single swappable seam.
 *
 * The demo fixtures are gone. Anything not yet backed by real rows returns an
 * empty list and the page says so plainly — a page must never invent content it
 * does not have. Today the store and vote sites read from the database; the
 * remaining sections fill in as their tables are populated.
 */
import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type {
  Accent,
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

type NewsRow = typeof schema.newsArticles.$inferSelect;

const NEWS_ACCENTS: Accent[] = ["violet", "cyan", "gold", "green", "rose", "orange"];

/** Stable accent per article so a card does not change colour between renders. */
function accentFor(slug: string): Accent {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return NEWS_ACCENTS[hash % NEWS_ACCENTS.length];
}

function toArticle(row: NewsRow): NewsArticle {
  const normalised = (row.content ?? "").replace(/\r\n?/g, "\n");
  const body = normalised.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const words = normalised.split(/\s+/).filter(Boolean).length;
  const published = row.publishedAt ?? row.createdAt;
  const publisherMode = row.publisherMode === "author" ? "author" : "team";
  const teamByline = publisherMode === "team";
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    body,
    category: row.category,
    accent: accentFor(row.slug),
    date: published instanceof Date ? published.toISOString() : String(published),
    author: teamByline ? "Mazora Team" : (row.authorName ?? row.discordAuthor ?? "Mazora Team"),
    authorRole: teamByline ? "Official Newsroom" : (row.authorRole ?? row.discordAuthorRole ?? "News Publisher"),
    authorAvatar: teamByline ? (row.teamAvatarUrl ?? "/images/mazora-icon.png") : (row.authorAvatarUrl ?? undefined),
    publisherMode,
    readMinutes: row.readTimeMinutes ?? Math.max(1, Math.round(words / 200)),
    featuredImage: row.featuredImage ?? undefined,
  };
}

export async function getNews(): Promise<NewsArticle[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.newsArticles)
      .where(and(
        eq(schema.newsArticles.status, "published"),
        or(isNull(schema.newsArticles.publishedAt), lte(schema.newsArticles.publishedAt, new Date())),
      ))
      .orderBy(sql`coalesce(${schema.newsArticles.publishedAt}, ${schema.newsArticles.createdAt}) desc`);
    return rows.map(toArticle);
  } catch (error) {
    console.error("Failed to load news:", error);
    return [];
  }
}

export async function getArticle(slug: string): Promise<NewsArticle | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select()
      .from(schema.newsArticles)
      .where(and(
        eq(schema.newsArticles.slug, slug),
        eq(schema.newsArticles.status, "published"),
        or(isNull(schema.newsArticles.publishedAt), lte(schema.newsArticles.publishedAt, new Date())),
      ))
      .limit(1);
    return row ? toArticle(row) : null;
  } catch (error) {
    console.error("Failed to load article:", error);
    return null;
  }
}

export async function getRelatedArticles(slug: string, category: string): Promise<NewsArticle[]> {
  const all = await getNews();
  return all.filter((a) => a.slug !== slug && a.category === category).slice(0, 3);
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

export async function getGallery(userId?: string | null): Promise<GalleryImage[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: schema.galleryImages.id,
        title: schema.galleryImages.title,
        description: schema.galleryImages.description,
        imageUrl: schema.galleryImages.imageUrl,
        thumbnailUrl: schema.galleryImages.thumbnailUrl,
        category: schema.galleryImages.category,
        authorName: schema.galleryImages.authorName,
        featured: schema.galleryImages.featured,
        likesCount: schema.galleryImages.likesCount,
        createdAt: schema.galleryImages.createdAt,
        userMinecraft: schema.profiles.username,
      })
      .from(schema.galleryImages)
      .leftJoin(schema.profiles, eq(schema.galleryImages.authorId, schema.profiles.userId))
      .where(eq(schema.galleryImages.status, "published"))
      .orderBy(desc(schema.galleryImages.featured), desc(schema.galleryImages.createdAt));

    let likedSet = new Set<string>();
    if (userId) {
      const likes = await db
        .select({ imageId: schema.galleryLikes.imageId })
        .from(schema.galleryLikes)
        .where(eq(schema.galleryLikes.userId, userId));
      likedSet = new Set(likes.map((l) => l.imageId));
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      imageUrl: r.imageUrl,
      thumbnailUrl: r.thumbnailUrl || r.imageUrl,
      category: r.category,
      author: r.userMinecraft || r.authorName || "Mazora Member",
      featured: r.featured,
      likesCount: r.likesCount ?? 0,
      hasLiked: likedSet.has(r.id),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  } catch (error) {
    console.error("Failed to load gallery:", error);
    return [];
  }
}
