import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/lib/db/client";
import type { ForumPostImage } from "@/lib/data/forums";

export interface ForumReportItem {
  id: string;
  reason: string;
  note: string | null;
  createdAt: string;
  reporter: string;
  /** Open reports on the same post, this one included. */
  reportCount: number;
  post: {
    id: string;
    body: string;
    author: string;
    createdAt: string;
    /** Set when the post, or the topic it belongs to, has been removed. */
    removed: boolean;
    isOpeningPost: boolean;
    images: ForumPostImage[];
  };
  topic: { id: string; title: string };
  forum: { id: string; name: string; slug: string };
}

const reporterProfile = alias(schema.profiles, "reporter_profile");
const authorProfile = alias(schema.profiles, "author_profile");

/**
 * Open reports, newest first, optionally for one forum.
 *
 * Staff-only reading: the caller must already have checked the Community
 * Forums permission. The post body is returned even for a removed post because
 * a moderator reviewing a report needs to see what was reported.
 */
export async function listOpenForumReports(forumId?: string): Promise<ForumReportItem[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        id: schema.forumReports.id,
        reason: schema.forumReports.reason,
        note: schema.forumReports.note,
        createdAt: schema.forumReports.createdAt,
        reporter: sql<string | null>`coalesce(${reporterProfile.displayName}, ${reporterProfile.username})`,
        reportCount: sql<number>`(count(*) over (partition by ${schema.forumReports.postId}))::int`,
        postId: schema.forumPosts.id,
        body: schema.forumPosts.body,
        postCreatedAt: schema.forumPosts.createdAt,
        postDeletedAt: schema.forumPosts.deletedAt,
        author: sql<string | null>`coalesce(${authorProfile.displayName}, ${authorProfile.username})`,
        topicId: schema.forumTopics.id,
        topicTitle: schema.forumTopics.title,
        topicDeletedAt: schema.forumTopics.deletedAt,
        openingPostId: sql<string>`(
          select p.id from ${schema.forumPosts} p
          where p.topic_id = ${schema.forumTopics.id}
          order by p.created_at asc limit 1
        )`,
        forumId: schema.forums.id,
        forumName: schema.forums.name,
        forumSlug: schema.forums.slug,
      })
      .from(schema.forumReports)
      .innerJoin(schema.forumPosts, eq(schema.forumPosts.id, schema.forumReports.postId))
      .innerJoin(schema.forumTopics, eq(schema.forumTopics.id, schema.forumPosts.topicId))
      .innerJoin(schema.forums, eq(schema.forums.id, schema.forumTopics.forumId))
      .leftJoin(reporterProfile, eq(reporterProfile.userId, schema.forumReports.reporterId))
      .leftJoin(authorProfile, eq(authorProfile.userId, schema.forumPosts.userId))
      .where(
        forumId
          ? and(eq(schema.forumReports.status, "open"), eq(schema.forums.id, forumId))
          : eq(schema.forumReports.status, "open"),
      )
      .orderBy(desc(schema.forumReports.createdAt));

    const postIds = [...new Set(rows.map((row) => row.postId))];
    const imageRows = postIds.length
      ? await db
          .select({
            id: schema.forumPostImages.id, postId: schema.forumPostImages.postId,
            url: schema.forumPostImages.url, sortOrder: schema.forumPostImages.sortOrder,
          })
          .from(schema.forumPostImages)
          .where(inArray(schema.forumPostImages.postId, postIds))
          .orderBy(asc(schema.forumPostImages.sortOrder))
      : [];
    const imagesByPost = new Map<string, ForumPostImage[]>();
    for (const { postId, ...image } of imageRows) {
      imagesByPost.set(postId, [...(imagesByPost.get(postId) ?? []), image]);
    }

    return rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      note: row.note,
      createdAt: new Date(row.createdAt).toISOString(),
      reporter: row.reporter ?? "Unknown",
      reportCount: row.reportCount,
      post: {
        id: row.postId,
        body: row.body,
        author: row.author ?? "Unknown",
        createdAt: new Date(row.postCreatedAt).toISOString(),
        removed: Boolean(row.postDeletedAt || row.topicDeletedAt),
        isOpeningPost: row.openingPostId === row.postId,
        images: imagesByPost.get(row.postId) ?? [],
      },
      topic: { id: row.topicId, title: row.topicTitle },
      forum: { id: row.forumId, name: row.forumName, slug: row.forumSlug },
    }));
  } catch (error) {
    console.error("Failed to load forum reports", error);
    return [];
  }
}

/** Open report counts per forum, for the flag badges in the admin. */
export async function openReportCountsByForum(): Promise<Record<string, number>> {
  const db = getDb();
  if (!db) return {};
  try {
    const rows = await db
      .select({ forumId: schema.forumTopics.forumId, n: count() })
      .from(schema.forumReports)
      .innerJoin(schema.forumPosts, eq(schema.forumPosts.id, schema.forumReports.postId))
      .innerJoin(schema.forumTopics, eq(schema.forumTopics.id, schema.forumPosts.topicId))
      .where(eq(schema.forumReports.status, "open"))
      .groupBy(schema.forumTopics.forumId);
    return Object.fromEntries(rows.map((row) => [row.forumId, row.n]));
  } catch (error) {
    console.error("Failed to count forum reports", error);
    return {};
  }
}
