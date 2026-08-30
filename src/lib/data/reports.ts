import "server-only";
import { asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/lib/db/client";
import type { SuggestionImage } from "@/lib/data/suggestions-board";

// Not exported: the brief specifies only ReportQueueItem as the module's
// public type. This is an internal shape helper referenced structurally by
// the exported interface below (mirrors BoardAuthor in suggestions-board.ts).
interface QueueAuthor {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ReportQueueItem {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
  reporter: QueueAuthor;
  target: {
    kind: "suggestion" | "reply";
    id: string;
    suggestionId: string;
    title: string;
    body: string;
    deletedAt: string | null;
    author: QueueAuthor;
    /** Attachments on the reported item. A moderator triaging an image report
     *  must be able to see what was reported without leaving the queue. */
    images: SuggestionImage[];
  };
  reportCount: number;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

// Distinct aliases for every extra reference to `profiles` / `suggestions` /
// `contentReports` in this query. A row's target lives in exactly one of two
// tables (contentReports.suggestionId / .replyId, enforced by a SQL CHECK),
// so the query left-joins BOTH candidate targets and their OWN, separately
// joined author profiles, then the mapper below picks the branch that
// matches which id is non-null. Because the suggestion-author join
// (suggestions.userId) and the reply-author join (suggestionReplies.userId)
// are two independent joins landing in two independent sets of output
// columns, a reply-target row can never pick up the parent suggestion's
// author — there is no shared column path between them to coalesce over.
const reporterProfile = alias(schema.profiles, "reporter_profile");
const suggestionAuthorProfile = alias(schema.profiles, "suggestion_author_profile");
const replyAuthorProfile = alias(schema.profiles, "reply_author_profile");
const replyParentSuggestion = alias(schema.suggestions, "reply_parent_suggestion");
const otherReports = alias(schema.contentReports, "other_reports");

// Correlated scalar subquery, one per report row (self-join on contentReports
// via a distinct alias so it never collides with the outer query's columns).
// It matches on whichever of suggestionId/replyId the OUTER row has set —
// the other branch's guard is false, so exactly one branch ever contributes
// and a row can never be counted under both a suggestion match and a reply
// match. This deliberately counts the row itself, which is correct: "open
// reports against this same target" includes the report being displayed.
// The FROM clause names the base table AND the alias. Interpolating the alias
// alone emits just the identifier, never `content_reports AS other_reports` —
// Drizzle binds an alias when the table is joined through the query builder,
// not when it is dropped into a raw sql fragment. Without the base table here
// Postgres rejected the entire query with 42P01 (relation "other_reports"
// does not exist), which took the admin reports queue down with it.
//
// Keep prose out of the template literal itself: a `--` SQL comment inside
// these backticks is still JS, so any ${...} in it would be interpolated.
const reportCountSql = sql<number>`cast((
  select count(*) from ${schema.contentReports} as ${otherReports}
  where ${otherReports.status} = 'open'
    and (
      (${schema.contentReports.suggestionId} is not null and ${otherReports.suggestionId} = ${schema.contentReports.suggestionId})
      or
      (${schema.contentReports.replyId} is not null and ${otherReports.replyId} = ${schema.contentReports.replyId})
    )
) as integer)`;

export async function listOpenReports(): Promise<ReportQueueItem[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        id: schema.contentReports.id,
        reason: schema.contentReports.reason,
        note: schema.contentReports.note,
        status: schema.contentReports.status,
        createdAt: schema.contentReports.createdAt,
        suggestionId: schema.contentReports.suggestionId,
        replyId: schema.contentReports.replyId,
        reporterUsername: reporterProfile.username,
        reporterDisplayName: reporterProfile.displayName,
        reporterAvatarUrl: reporterProfile.avatarUrl,
        suggestionTitle: schema.suggestions.title,
        suggestionDescription: schema.suggestions.description,
        suggestionAuthorUsername: suggestionAuthorProfile.username,
        suggestionAuthorDisplayName: suggestionAuthorProfile.displayName,
        suggestionAuthorAvatarUrl: suggestionAuthorProfile.avatarUrl,
        replySuggestionId: schema.suggestionReplies.suggestionId,
        replyBody: schema.suggestionReplies.body,
        replyDeletedAt: schema.suggestionReplies.deletedAt,
        replyParentTitle: replyParentSuggestion.title,
        replyAuthorUsername: replyAuthorProfile.username,
        replyAuthorDisplayName: replyAuthorProfile.displayName,
        replyAuthorAvatarUrl: replyAuthorProfile.avatarUrl,
        reportCount: reportCountSql,
      })
      .from(schema.contentReports)
      .leftJoin(reporterProfile, eq(schema.contentReports.reporterId, reporterProfile.userId))
      .leftJoin(schema.suggestions, eq(schema.contentReports.suggestionId, schema.suggestions.id))
      .leftJoin(suggestionAuthorProfile, eq(schema.suggestions.userId, suggestionAuthorProfile.userId))
      .leftJoin(schema.suggestionReplies, eq(schema.contentReports.replyId, schema.suggestionReplies.id))
      .leftJoin(replyAuthorProfile, eq(schema.suggestionReplies.userId, replyAuthorProfile.userId))
      .leftJoin(replyParentSuggestion, eq(schema.suggestionReplies.suggestionId, replyParentSuggestion.id))
      .where(eq(schema.contentReports.status, "open"))
      .orderBy(desc(schema.contentReports.createdAt));

    // One query for the whole queue: images for every reported suggestion and
    // every reported reply, grouped in memory. Same shape as the thread reader,
    // so adding attachments to the queue costs one round trip, not one per row.
    const reportedSuggestionIds = [...new Set(rows.map((r) => r.suggestionId).filter((v): v is string => Boolean(v)))];
    const reportedReplyIds = [...new Set(rows.map((r) => r.replyId).filter((v): v is string => Boolean(v)))];
    const imagesBySuggestion = new Map<string, SuggestionImage[]>();
    const imagesByReply = new Map<string, SuggestionImage[]>();

    if (reportedSuggestionIds.length || reportedReplyIds.length) {
      const conditions = [] as ReturnType<typeof inArray>[];
      if (reportedSuggestionIds.length) conditions.push(inArray(schema.suggestionImages.suggestionId, reportedSuggestionIds));
      if (reportedReplyIds.length) conditions.push(inArray(schema.suggestionImages.replyId, reportedReplyIds));

      const imageRows = await db
        .select({
          id: schema.suggestionImages.id,
          url: schema.suggestionImages.url,
          sortOrder: schema.suggestionImages.sortOrder,
          suggestionId: schema.suggestionImages.suggestionId,
          replyId: schema.suggestionImages.replyId,
        })
        .from(schema.suggestionImages)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .orderBy(asc(schema.suggestionImages.sortOrder));

      for (const row of imageRows) {
        const image = { id: row.id, url: row.url, sortOrder: row.sortOrder };
        const target = row.replyId ? imagesByReply : imagesBySuggestion;
        const key = (row.replyId ?? row.suggestionId) as string;
        const list = target.get(key) ?? [];
        list.push(image);
        target.set(key, list);
      }
    }

    return rows.map((r) => {
      const reporter: QueueAuthor = {
        username: r.reporterUsername || "community_member",
        displayName: r.reporterDisplayName || null,
        avatarUrl: r.reporterAvatarUrl || null,
      };

      // Derived from which column is non-null — never from a stored
      // discriminator (contentReports has none; the SQL CHECK guarantees
      // exactly one of suggestionId/replyId is set per row).
      const target =
        r.replyId !== null
          ? {
              kind: "reply" as const,
              id: r.replyId,
              suggestionId: r.replySuggestionId as string,
              title: r.replyParentTitle || "",
              body: r.replyBody || "",
              deletedAt: toIsoOrNull(r.replyDeletedAt),
              author: {
                username: r.replyAuthorUsername || "community_member",
                displayName: r.replyAuthorDisplayName || null,
                avatarUrl: r.replyAuthorAvatarUrl || null,
              },
              images: imagesByReply.get(r.replyId) ?? [],
            }
          : {
              kind: "suggestion" as const,
              id: r.suggestionId as string,
              suggestionId: r.suggestionId as string,
              title: r.suggestionTitle || "",
              body: r.suggestionDescription || "",
              deletedAt: null,
              author: {
                username: r.suggestionAuthorUsername || "community_member",
                displayName: r.suggestionAuthorDisplayName || null,
                avatarUrl: r.suggestionAuthorAvatarUrl || null,
              },
              images: imagesBySuggestion.get(r.suggestionId as string) ?? [],
            };

      return {
        id: r.id,
        reason: r.reason,
        note: r.note,
        status: r.status,
        createdAt: toIso(r.createdAt),
        reporter,
        target,
        reportCount: Number(r.reportCount) || 0,
      };
    });
  } catch (error) {
    console.error("Failed to load content report queue", error);
    return [];
  }
}
