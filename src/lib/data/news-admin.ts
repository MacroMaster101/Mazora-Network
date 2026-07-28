import "server-only";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export interface AdminArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  status: string;
  source: string;
  authorName: string | null;
  authorRole: string | null;
  authorAvatarUrl: string | null;
  teamAvatarUrl: string | null;
  readTimeMinutes: number | null;
  publisherMode: "team" | "author";
  discordAuthor: string | null;
  discordAuthorRole: string | null;
  discordAuthorAvatarUrl: string | null;
  discordMessageId: string | null;
  featuredImage: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNews {
  /** Imported from Discord, waiting on a decision. */
  pending: AdminArticle[];
  /** Live on the public site. */
  articles: AdminArticle[];
  /** Rejected or taken down — off the site, but still editable and restorable. */
  hidden: AdminArticle[];
}

/** Every article, grouped by what staff can do with it. */
export async function getAdminNews(): Promise<AdminNews | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(schema.newsArticles).orderBy(desc(schema.newsArticles.createdAt));
    const mapped: AdminArticle[] = rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt ?? "",
      content: r.content ?? "",
      category: r.category,
      status: r.status,
      source: r.source,
      authorName: r.authorName,
      authorRole: r.authorRole,
      authorAvatarUrl: r.authorAvatarUrl,
      teamAvatarUrl: r.teamAvatarUrl,
      readTimeMinutes: r.readTimeMinutes,
      publisherMode: r.publisherMode === "author" ? "author" : "team",
      discordAuthor: r.discordAuthor,
      discordAuthorRole: r.discordAuthorRole,
      discordAuthorAvatarUrl: r.discordAuthorAvatarUrl,
      discordMessageId: r.discordMessageId,
      featuredImage: r.featuredImage,
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
    // Rejected rows used to disappear from the admin entirely, which made a
    // mis-click unrecoverable. They are kept as tombstones for Discord dedup, so
    // they are listed here alongside taken-down articles instead.
    const isHidden = (a: AdminArticle) => a.status === "rejected" || a.status === "hidden";
    return {
      pending: mapped.filter((a) => a.status === "pending"),
      articles: mapped.filter((a) => a.status !== "pending" && !isHidden(a)),
      hidden: mapped.filter(isHidden),
    };
  } catch (error) {
    console.error("Failed to load admin news:", error);
    return null;
  }
}
