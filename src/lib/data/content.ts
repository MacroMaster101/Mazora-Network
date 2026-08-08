/**
 * Content repositories. Pages import ONLY from here (and players/status), never
 * the database driver directly, so the data source stays a single swappable seam.
 *
 * The demo fixtures are gone. Anything not yet backed by real rows returns an
 * empty list and the page says so plainly — a page must never invent content it
 * does not have. Today the store and vote sites read from the database; the
 * remaining sections fill in as their tables are populated.
 */
import { and, asc, desc, eq, getTableColumns, isNull, lte, or, sql } from "drizzle-orm";
import type {
  Accent,
  EventItem,
  GalleryImage,
  GameMode,
  NewsArticle,
  Product,
  RuleCategory,
  VoteSite,
  TopVoter,
} from "@/lib/types";
import { getDb, schema } from "@/lib/db/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/* ------------------------------------------------------------------ *
 * Store — backed by the products table (see scripts/seed-store.ts).
 * ------------------------------------------------------------------ */

type ProductRow = typeof schema.products.$inferSelect;

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
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
    gameModeSlug: row.gameModeSlug,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
  };
}

export async function getProducts(): Promise<Product[]> {
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("products")
        .select("*")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        return data.map((row) => ({
          id: String(row.id),
          slug: String(row.slug),
          name: String(row.name),
          imageUrl: row.image_url ?? undefined,
          category: row.category as Product["category"],
          description: row.description ?? "",
          price: Number(row.price),
          salePrice: row.sale_price != null ? Number(row.sale_price) : undefined,
          features: Array.isArray(row.features) ? row.features : [],
          accent: (row.accent ?? "violet") as Product["accent"],
          badge: row.badge ?? undefined,
          family: row.family ?? undefined,
          billing: row.billing ?? undefined,
          subcategory: row.subcategory ?? undefined,
          gameModeSlug: row.game_mode_slug ?? "survival-smp",
          sortOrder: Number(row.sort_order ?? 0),
          enabled: Boolean(row.enabled),
        }));
      }
    } catch {
      // Fallthrough to Drizzle driver below
    }
  }

  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.enabled, true))
      .orderBy(asc(schema.products.sortOrder));
    return rows.map(toProduct);
  } catch {
    return [];
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((p) => p.slug === slug) ?? null;
}

export async function getAdminProducts(): Promise<Product[]> {
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!error && data) {
        return data.map((row) => ({
          id: String(row.id),
          slug: String(row.slug),
          name: String(row.name),
          imageUrl: row.image_url ?? undefined,
          category: row.category as Product["category"],
          description: row.description ?? "",
          price: Number(row.price),
          salePrice: row.sale_price != null ? Number(row.sale_price) : undefined,
          features: Array.isArray(row.features) ? row.features : [],
          accent: (row.accent ?? "violet") as Product["accent"],
          badge: row.badge ?? undefined,
          family: row.family ?? undefined,
          billing: row.billing ?? undefined,
          subcategory: row.subcategory ?? undefined,
          gameModeSlug: row.game_mode_slug ?? "survival-smp",
          sortOrder: Number(row.sort_order ?? 0),
          enabled: Boolean(row.enabled),
        }));
      }
    } catch {
      // Fallthrough to Drizzle
    }
  }

  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(schema.products).orderBy(asc(schema.products.sortOrder));
    return rows.map(toProduct);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Voting — vote sites live in the database; standings come from votes.
 * ------------------------------------------------------------------ */

export async function getVoteSites(): Promise<VoteSite[]> {
  const { getAdminVoteSites } = await import("@/lib/data/voting");
  const all = await getAdminVoteSites();
  return all.filter((s) => s.enabled);
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

type GameModeRow = typeof schema.gameModes.$inferSelect;

function toGameMode(row: GameModeRow): GameMode {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    accent: row.accent as Accent,
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    players: row.playerCount,
    version: row.version,
    features: Array.isArray(row.features) ? row.features as string[] : [],
    commands: Array.isArray(row.commands) ? row.commands as GameMode["commands"] : [],
    rules: Array.isArray(row.rules) ? row.rules as string[] : [],
    storeStatus: row.storeStatus === "live" ? "live" : "coming_soon",
    sortOrder: row.sortOrder,
    enabled: row.enabled,
  };
}

export async function getGameModes(): Promise<GameMode[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(schema.gameModes).where(eq(schema.gameModes.enabled, true)).orderBy(asc(schema.gameModes.sortOrder));
    return rows.map(toGameMode);
  } catch (error) {
    console.error("Failed to load game modes:", error);
    return [];
  }
}

export async function getAdminGameModes(): Promise<GameMode[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(schema.gameModes).orderBy(asc(schema.gameModes.sortOrder));
    return rows.map(toGameMode);
  } catch (error) {
    console.error("Failed to load admin game modes:", error);
    return [];
  }
}

export async function getGameMode(slug: string): Promise<GameMode | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(schema.gameModes).where(eq(schema.gameModes.slug, slug)).limit(1);
    return row && row.enabled ? toGameMode(row) : null;
  } catch (error) {
    console.error("Failed to load game mode:", error);
    return null;
  }
}

type NewsRow = typeof schema.newsArticles.$inferSelect;

const NEWS_ACCENTS: Accent[] = ["violet", "cyan", "gold", "green", "rose", "orange"];

/** Stable accent per article so a card does not change colour between renders. */
function accentFor(slug: string): Accent {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return NEWS_ACCENTS[hash % NEWS_ACCENTS.length];
}

/**
 * Live profile fields joined in by authorId. When present for an
 * "author"-mode article, these win over the article's own stored
 * authorName/authorAvatarUrl columns — those are a one-time snapshot from
 * whenever the publisher was last set, which goes stale the moment the
 * author uploads a new photo or switches to a Minecraft skin avatar (the old
 * file is deleted). Reading the live profile means the byline always shows
 * whatever the author currently has set, everywhere, without needing the
 * snapshot re-saved. Discord-imported articles have no linked authorId and
 * keep using the stored discordAuthor snapshot, same as before.
 */
type LiveAuthorProfile = { avatarUrl: string | null; displayName: string | null; username: string | null } | null;

/**
 * Profiles looked up by byline name, keyed lowercase.
 *
 * Articles imported from Discord carry no `author_id`, so the join on that
 * column resolves nothing for them — which is why their bylines fell back to a
 * stale avatar snapshot and rendered a monogram. Their stored `author_name` is
 * still a real site username (staff pick the publisher when reviewing the
 * import), and `profiles.username` is uniquely indexed, so matching on it is an
 * unambiguous 1:1 lookup rather than a guess.
 */
export async function profilesByBylineName(
  names: string[],
): Promise<Map<string, { avatarUrl: string | null; displayName: string | null; username: string }>> {
  const map = new Map<string, { avatarUrl: string | null; displayName: string | null; username: string }>();
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (wanted.length === 0) return map;

  const admin = getSupabaseAdmin();
  if (!admin) return map;
  try {
    const { data } = await admin
      .from("profiles")
      .select("username, display_name, avatar_url")
      .in("username", wanted);
    for (const row of data ?? []) {
      map.set(String(row.username).toLowerCase(), {
        avatarUrl: row.avatar_url ?? null,
        displayName: row.display_name ?? null,
        username: String(row.username),
      });
    }
  } catch {
    // A byline avatar is cosmetic; never fail article loading over it.
  }
  return map;
}

function toArticle(row: NewsRow, liveAuthor?: LiveAuthorProfile): NewsArticle {
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
    author: teamByline
      ? "Mazora Team"
      : (liveAuthor?.displayName || liveAuthor?.username) ?? (row.authorName ?? row.discordAuthor ?? "Mazora Team"),
    authorRole: teamByline ? "Official Newsroom" : (row.authorRole ?? row.discordAuthorRole ?? "News Publisher"),
    authorAvatar: teamByline
      ? (row.teamAvatarUrl ?? "/images/mazora-icon.png")
      : (liveAuthor?.avatarUrl ?? row.authorAvatarUrl ?? undefined),
    publisherMode,
    readMinutes: row.readTimeMinutes ?? Math.max(1, Math.round(words / 200)),
    featuredImage: row.featuredImage ?? undefined,
  };
}

export async function getNews(): Promise<NewsArticle[]> {
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("news_articles")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (!error && data) {
        // Live profile lookup, same reasoning as toArticle: author_name/
        // author_avatar_url are a one-time snapshot that goes stale the
        // moment the author changes their photo, so the current profile wins
        // whenever the article is linked to one.
        const authorIds = [...new Set(data.map((row) => row.author_id).filter(Boolean))];
        const profileById = new Map<string, { avatar_url: string | null; display_name: string | null; username: string | null }>();
        if (authorIds.length) {
          const { data: profiles } = await admin
            .from("profiles")
            .select("user_id, avatar_url, display_name, username")
            .in("user_id", authorIds);
          for (const p of profiles ?? []) profileById.set(String(p.user_id), p);
        }

        // Discord imports have no author_id, so the lookup above misses them
        // entirely. Fall back to matching their byline name against a username.
        const byName = await profilesByBylineName(
          data
            .filter((row) => row.publisher_mode === "author" && !profileById.has(String(row.author_id ?? "")))
            .map((row) => String(row.author_name ?? "")),
        );

        return data.map((row) => {
          // This hardcoded "team" used to ignore the row's real publisher_mode
          // entirely, so every article's byline read "Mazora Team" here even
          // when getArticle() (below, via toArticle) correctly showed the
          // individual author for the very same row. Mirror toArticle's logic
          // so the home/listing byline matches the article page.
          const publisherMode = row.publisher_mode === "author" ? "author" : "team";
          const teamByline = publisherMode === "team";
          const liveById = row.author_id ? profileById.get(String(row.author_id)) : undefined;
          const liveByName = byName.get(String(row.author_name ?? "").trim().toLowerCase());
          const liveProfile = liveById ?? (liveByName
            ? { avatar_url: liveByName.avatarUrl, display_name: liveByName.displayName, username: liveByName.username }
            : undefined);
          return {
            slug: String(row.slug),
            title: String(row.title),
            excerpt: String(row.excerpt ?? ""),
            body: String(row.body ?? row.content ?? "")
              .replace(/\r\n?/g, "\n")
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean),
            category: String(row.category ?? "News"),
            accent: "violet",
            date: String(row.published_at ?? row.created_at ?? new Date().toISOString()),
            author: teamByline
              ? "Mazora Team"
              : String((liveProfile?.display_name || liveProfile?.username) ?? row.author_name ?? row.discord_author ?? "Mazora Team"),
            authorRole: teamByline
              ? "Official Newsroom"
              : String(row.author_role ?? row.discord_author_role ?? "News Publisher"),
            authorAvatar: teamByline
              ? (row.team_avatar_url ?? "/images/mazora-icon.png")
              : (liveProfile?.avatar_url ?? row.author_avatar_url ?? undefined),
            publisherMode,
            readMinutes: Number(row.read_time_minutes ?? 2),
            featuredImage: row.featured_image ?? undefined,
          };
        });
      }
    } catch {
      // Fallthrough
    }
  }

  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        ...getTableColumns(schema.newsArticles),
        liveAvatarUrl: schema.profiles.avatarUrl,
        liveDisplayName: schema.profiles.displayName,
        liveUsername: schema.profiles.username,
      })
      .from(schema.newsArticles)
      .leftJoin(schema.profiles, eq(schema.newsArticles.authorId, schema.profiles.userId))
      .where(and(
        eq(schema.newsArticles.status, "published"),
        or(isNull(schema.newsArticles.publishedAt), lte(schema.newsArticles.publishedAt, new Date())),
      ))
      .orderBy(sql`coalesce(${schema.newsArticles.publishedAt}, ${schema.newsArticles.createdAt}) desc`);
    // Same byline-name fallback as the Supabase path above, for the rows the
    // authorId join could not resolve (Discord imports).
    const byName = await profilesByBylineName(
      rows.filter((r) => r.publisherMode === "author" && !r.liveAvatarUrl).map((r) => String(r.authorName ?? "")),
    );
    return rows.map((row) => {
      const fallback = byName.get(String(row.authorName ?? "").trim().toLowerCase());
      return toArticle(row, {
        avatarUrl: row.liveAvatarUrl ?? fallback?.avatarUrl ?? null,
        displayName: row.liveDisplayName ?? fallback?.displayName ?? null,
        username: row.liveUsername ?? fallback?.username ?? null,
      });
    });
  } catch {
    return [];
  }
}

export async function getArticle(slug: string): Promise<NewsArticle | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({
        ...getTableColumns(schema.newsArticles),
        liveAvatarUrl: schema.profiles.avatarUrl,
        liveDisplayName: schema.profiles.displayName,
        liveUsername: schema.profiles.username,
      })
      .from(schema.newsArticles)
      .leftJoin(schema.profiles, eq(schema.newsArticles.authorId, schema.profiles.userId))
      .where(and(
        eq(schema.newsArticles.slug, slug),
        eq(schema.newsArticles.status, "published"),
        or(isNull(schema.newsArticles.publishedAt), lte(schema.newsArticles.publishedAt, new Date())),
      ))
      .limit(1);
    if (!row) return null;
    // Discord-imported articles carry no authorId, so resolve by byline name.
    const fallback = row.publisherMode === "author" && !row.liveAvatarUrl
      ? (await profilesByBylineName([String(row.authorName ?? "")])).get(
          String(row.authorName ?? "").trim().toLowerCase(),
        )
      : undefined;
    return toArticle(row, {
      avatarUrl: row.liveAvatarUrl ?? fallback?.avatarUrl ?? null,
      displayName: row.liveDisplayName ?? fallback?.displayName ?? null,
      username: row.liveUsername ?? fallback?.username ?? null,
    });
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

// getStaff() lived here as a stub that always returned an empty array. Its only
// caller was the admin Staff board, which therefore reported "0 team members"
// while six people held staff ranks. The board now derives the team from
// account ranks (see @/lib/data/accounts), so the stub has no callers and has
// been removed rather than left to mislead the next reader.

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
