import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { providerAvatarsFor } from "@/lib/data/provider-avatars";
import type { SuggestionSort } from "@/lib/suggestions-rules";

// Not exported: the brief specifies only BoardSuggestion / SuggestionThread /
// ThreadReply as the module's public types. These two are internal shape
// helpers referenced structurally by the exported interfaces below.
type SuggestionStatus = "open" | "under_review" | "planned" | "completed" | "declined";

interface BoardAuthor {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface BoardSuggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  status: SuggestionStatus;
  locked: boolean;
  createdAt: string;
  author: BoardAuthor;
  votesCount: number;
  hasVoted: boolean;
  repliesCount: number;
  imageCount: number;
}

export interface SuggestionImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ThreadReply {
  id: string;
  authorId: string;
  author: BoardAuthor;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  parentId: string | null;
  children: ThreadReply[];
  images: SuggestionImage[];
}

export interface SuggestionThread extends BoardSuggestion {
  // Not on BoardSuggestion: the board list has no reason to know it, but the
  // thread view needs it to build a ReportTarget for the suggestion itself
  // (see ReportButton) without re-deriving permissions in a Client Component.
  authorId: string;
  description: string;
  replies: ThreadReply[];
  images: SuggestionImage[];
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

// Correlated scalar subqueries, one per suggestion row. Each subquery is
// independent of the other (and of the `profiles` leftJoin above it), so
// there is no shared join to fan out and no risk of one count inflating the
// other the way a joined-then-grouped query could.
const votesCountSql = sql<number>`cast((
  select count(*) from ${schema.suggestionVotes}
  where ${schema.suggestionVotes.suggestionId} = ${schema.suggestions.id}
) as integer)`;

const repliesCountSql = sql<number>`cast((
  select count(*) from ${schema.suggestionReplies}
  where ${schema.suggestionReplies.suggestionId} = ${schema.suggestions.id}
    and ${schema.suggestionReplies.deletedAt} is null
) as integer)`;

const imageCountSql = sql<number>`cast((
  select count(*) from ${schema.suggestionImages}
  where ${schema.suggestionImages.suggestionId} = ${schema.suggestions.id}
) as integer)`;

export async function listBoardSuggestions(opts: {
  sort: SuggestionSort;
  category?: string;
  status?: string;
  viewerId?: string | null;
}): Promise<BoardSuggestion[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [];
    if (opts.category) conditions.push(eq(schema.suggestions.category, opts.category));
    if (opts.status) conditions.push(eq(schema.suggestions.status, opts.status));

    const query = db
      .select({
        id: schema.suggestions.id,
        title: schema.suggestions.title,
        description: schema.suggestions.description,
        category: schema.suggestions.category,
        status: schema.suggestions.status,
        locked: schema.suggestions.locked,
        createdAt: schema.suggestions.createdAt,
        authorId: schema.suggestions.userId,
        authorUsername: schema.profiles.username,
        authorDisplayName: schema.profiles.displayName,
        authorAvatarUrl: schema.profiles.avatarUrl,
        votesCount: votesCountSql,
        repliesCount: repliesCountSql,
        imageCount: imageCountSql,
      })
      .from(schema.suggestions)
      .leftJoin(schema.profiles, eq(schema.suggestions.userId, schema.profiles.userId))
      .where(conditions.length ? and(...conditions) : undefined);

    const rows = await (opts.sort === "top"
      ? query.orderBy(desc(votesCountSql), desc(schema.suggestions.createdAt))
      : query.orderBy(desc(schema.suggestions.createdAt)));

    const votedIds = opts.viewerId
      ? new Set(
          (
            await db
              .select({ id: schema.suggestionVotes.suggestionId })
              .from(schema.suggestionVotes)
              .where(eq(schema.suggestionVotes.userId, opts.viewerId))
          ).map((r) => r.id),
        )
      : new Set<string>();

    // Members who signed in with Google/Discord and never opened profile
    // settings have no chosen avatar, yet the header still shows their provider
    // photo. Resolve the same fallback so the board agrees with the header.
    const providerAvatars = await providerAvatarsFor(
      rows.filter((r) => !r.authorAvatarUrl).map((r) => r.authorId),
    );

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category || "Gameplay",
      status: (r.status as SuggestionStatus) || "open",
      locked: Boolean(r.locked),
      createdAt: toIso(r.createdAt),
      author: {
        username: r.authorUsername || "community_member",
        displayName: r.authorDisplayName || null,
        avatarUrl: r.authorAvatarUrl || providerAvatars.get(r.authorId) || null,
      },
      votesCount: Number(r.votesCount) || 0,
      hasVoted: votedIds.has(r.id),
      repliesCount: Number(r.repliesCount) || 0,
      imageCount: Number(r.imageCount) || 0,
    }));
  } catch (error) {
    console.error("Failed to load board suggestions", error);
    return [];
  }
}

export async function getSuggestionThread(id: string, viewerId?: string | null): Promise<SuggestionThread | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db
      .select({
        id: schema.suggestions.id,
        authorId: schema.suggestions.userId,
        title: schema.suggestions.title,
        category: schema.suggestions.category,
        description: schema.suggestions.description,
        status: schema.suggestions.status,
        locked: schema.suggestions.locked,
        createdAt: schema.suggestions.createdAt,
        authorUsername: schema.profiles.username,
        authorDisplayName: schema.profiles.displayName,
        authorAvatarUrl: schema.profiles.avatarUrl,
        votesCount: votesCountSql,
        repliesCount: repliesCountSql,
        imageCount: imageCountSql,
      })
      .from(schema.suggestions)
      .leftJoin(schema.profiles, eq(schema.suggestions.userId, schema.profiles.userId))
      .where(eq(schema.suggestions.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    // Not filtered by deletedAt: soft-deleted replies stay in position so the
    // thread keeps its shape; a later task renders a tombstone in their place.
    const replyRows = await db
      .select({
        id: schema.suggestionReplies.id,
        authorId: schema.suggestionReplies.userId,
        body: schema.suggestionReplies.body,
        createdAt: schema.suggestionReplies.createdAt,
        editedAt: schema.suggestionReplies.editedAt,
        deletedAt: schema.suggestionReplies.deletedAt,
        parentId: schema.suggestionReplies.parentId,
        authorUsername: schema.profiles.username,
        authorDisplayName: schema.profiles.displayName,
        authorAvatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.suggestionReplies)
      .leftJoin(schema.profiles, eq(schema.suggestionReplies.userId, schema.profiles.userId))
      .where(eq(schema.suggestionReplies.suggestionId, id))
      .orderBy(asc(schema.suggestionReplies.createdAt));

    // One query for the whole thread: the suggestion's own images plus every
    // reply's, grouped in memory — same shape as the reply grouping above, so
    // this adds no N+1.
    const replyIds = replyRows.map((r) => r.id);
    const imageRows = await db
      .select({
        id: schema.suggestionImages.id,
        url: schema.suggestionImages.url,
        sortOrder: schema.suggestionImages.sortOrder,
        suggestionId: schema.suggestionImages.suggestionId,
        replyId: schema.suggestionImages.replyId,
      })
      .from(schema.suggestionImages)
      .where(
        replyIds.length
          ? or(
              eq(schema.suggestionImages.suggestionId, id),
              inArray(schema.suggestionImages.replyId, replyIds),
            )
          : eq(schema.suggestionImages.suggestionId, id),
      )
      .orderBy(asc(schema.suggestionImages.sortOrder));

    const suggestionImages: SuggestionImage[] = [];
    const imagesByReply = new Map<string, SuggestionImage[]>();
    for (const row of imageRows) {
      const image = { id: row.id, url: row.url, sortOrder: row.sortOrder };
      if (row.replyId) {
        const list = imagesByReply.get(row.replyId) ?? [];
        list.push(image);
        imagesByReply.set(row.replyId, list);
      } else {
        suggestionImages.push(image);
      }
    }

    let hasVoted = false;
    if (viewerId) {
      const voteRows = await db
        .select({ id: schema.suggestionVotes.id })
        .from(schema.suggestionVotes)
        .where(and(eq(schema.suggestionVotes.suggestionId, id), eq(schema.suggestionVotes.userId, viewerId)))
        .limit(1);
      hasVoted = voteRows.length > 0;
    }

    // One lookup for the whole thread: the suggestion's author plus every reply
    // author who has not chosen a profile avatar.
    const providerAvatars = await providerAvatarsFor([
      row.authorAvatarUrl ? null : row.authorId,
      ...replyRows.filter((r) => !r.authorAvatarUrl).map((r) => r.authorId),
    ]);

    return {
      id: row.id,
      authorId: row.authorId,
      title: row.title,
      category: row.category || "Gameplay",
      description: row.description,
      status: (row.status as SuggestionStatus) || "open",
      locked: Boolean(row.locked),
      createdAt: toIso(row.createdAt),
      author: {
        username: row.authorUsername || "community_member",
        displayName: row.authorDisplayName || null,
        avatarUrl: row.authorAvatarUrl || providerAvatars.get(row.authorId) || null,
      },
      votesCount: Number(row.votesCount) || 0,
      hasVoted,
      repliesCount: Number(row.repliesCount) || 0,
      imageCount: Number(row.imageCount) || 0,
      images: suggestionImages,
      replies: (() => {
        // Two-pass grouping: rows are already createdAt-ordered (see the
        // orderBy above), so both the top-level list and each parent's
        // children come out oldest-first with no re-sorting needed here.
        const mapped: ThreadReply[] = replyRows.map((r) => ({
          id: r.id,
          authorId: r.authorId,
          author: {
            username: r.authorUsername || "community_member",
            displayName: r.authorDisplayName || null,
            avatarUrl: r.authorAvatarUrl || providerAvatars.get(r.authorId) || null,
          },
          // A removed reply keeps its position, but its text must never reach the
          // client: replies are rendered by a Client Component, so anything returned
          // here is serialised into the RSC payload and readable in the page source
          // even though the DOM shows a tombstone. The row keeps its body in the
          // database — that is what soft delete is for.
          body: r.deletedAt ? "" : r.body,
          createdAt: toIso(r.createdAt),
          editedAt: toIsoOrNull(r.editedAt),
          deletedAt: toIsoOrNull(r.deletedAt),
          parentId: r.parentId,
          children: [],
          // A removed reply must not leak its attachments either — same reason
          // its body is blanked above: this is serialised into the RSC payload
          // and readable in page source even when the DOM shows a tombstone.
          images: r.deletedAt ? [] : (imagesByReply.get(r.id) ?? []),
        }));

        const byId = new Map(mapped.map((r) => [r.id, r]));
        const topLevel: ThreadReply[] = [];
        for (const reply of mapped) {
          const parent = reply.parentId ? byId.get(reply.parentId) : undefined;
          if (parent) {
            parent.children.push(reply);
          } else {
            // A null parentId, or a parentId not present among this thread's
            // rows, renders top-level rather than being dropped.
            topLevel.push(reply);
          }
        }
        return topLevel;
      })(),
    };
  } catch (error) {
    console.error("Failed to load suggestion thread", error);
    return null;
  }
}
