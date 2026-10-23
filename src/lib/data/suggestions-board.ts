import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { isRoleKey, normalizeRoleKey, publicRole } from "@/lib/auth/roles";
import {
  buildCommentTree, countComments, selectCommentView,
  type CommentNode, type CommentSort, type FlatComment,
} from "@/lib/comments/tree";
import type { VoteValue } from "@/lib/comments/vote-rules";
import { getDb, schema } from "@/lib/db/client";
import { ensureRoleCatalog } from "@/lib/data/roles";
import { mapCommentNodes, shownCommentIds } from "@/lib/data/forums";
import { getPresenceFor } from "@/lib/data/presence";
import { providerAvatarsFor } from "@/lib/data/provider-avatars";
import type { PresenceShown } from "@/lib/presence-rules";
import type { SuggestionSort } from "@/lib/suggestions-rules";
import type { Role } from "@/lib/types";

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

export interface ThreadReply extends FlatComment {
  /** The viewer wrote this reply. Sent instead of the author's auth id, which never leaves the loader. */
  isOwn: boolean;
  /** Written by the suggestion's author. */
  isOp: boolean;
  author: BoardAuthor;
  /** From auth app_metadata, like every session's role — profiles.role is stale. */
  authorRole: Role;
  body: string;
  editedAt: string | null;
  images: SuggestionImage[];
  myVote: VoteValue;
  /** The author's website status, absent when they are offline or invisible. */
  authorStatus: Exclude<PresenceShown, "offline"> | null;
}

export interface SuggestionThread extends BoardSuggestion {
  // Not on BoardSuggestion: the board list has no reason to know it, but the
  // thread view needs it to build a ReportTarget for the suggestion itself
  // (see ReportButton). Whether the viewer wrote it, never the author's id.
  isOwn: boolean;
  description: string;
  images: SuggestionImage[];
  /** This view's comment tree: the whole thread, or the focused subtree as one node. */
  replies: CommentNode<ThreadReply>[];
  /** Visible replies in the whole thread. */
  totalReplies: number;
  focusId: string | null;
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

/** Suggestions one board view reads. The board has no pager; this keeps one view bounded. */
export const BOARD_SUGGESTIONS_LIMIT = 100;

/** Characters of a description the board reads. Cards clamp it to two lines. */
const BOARD_DESCRIPTION_PREVIEW = 320;

const descriptionPreviewSql = sql<string>`left(${schema.suggestions.description}, ${BOARD_DESCRIPTION_PREVIEW})`;

export async function listBoardSuggestions(opts: {
  sort: SuggestionSort;
  category?: string;
  status?: string;
  viewerId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<BoardSuggestion[]> {
  const db = getDb();
  if (!db) return [];

  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? BOARD_SUGGESTIONS_LIMIT)), BOARD_SUGGESTIONS_LIMIT);
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));

  try {
    const conditions = [];
    if (opts.category) conditions.push(eq(schema.suggestions.category, opts.category));
    if (opts.status) conditions.push(eq(schema.suggestions.status, opts.status));

    const query = db
      .select({
        id: schema.suggestions.id,
        title: schema.suggestions.title,
        description: descriptionPreviewSql,
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
      ? query.orderBy(desc(votesCountSql), desc(schema.suggestions.createdAt), desc(schema.suggestions.id))
      : query.orderBy(desc(schema.suggestions.createdAt), desc(schema.suggestions.id))
    )
      .limit(limit)
      .offset(offset);

    // Only this view's suggestions: the viewer's whole vote history is not needed to mark them.
    const rowIds = rows.map((r) => r.id);
    const votedIds =
      opts.viewerId && rowIds.length
        ? new Set(
            (
              await db
                .select({ id: schema.suggestionVotes.suggestionId })
                .from(schema.suggestionVotes)
                .where(and(eq(schema.suggestionVotes.userId, opts.viewerId), inArray(schema.suggestionVotes.suggestionId, rowIds)))
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
      description: r.description ?? "",
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

/**
 * Ceiling on the replies one thread view reads. Far above any real discussion
 * here; it keeps a flooded thread from turning one page view into an unbounded
 * read. Replies past it (the newest) are not shown.
 */
export const MAX_THREAD_REPLIES = 2000;

/**
 * One suggestion and its reply tree.
 *
 * Read like a forum topic (getTopicComments): first the tree's shape — ids,
 * parents, timestamps and vote totals, no text — then bodies, authors, images,
 * presence and the viewer's votes only for the replies this view shows. A
 * removed reply with nothing visible under it, or one below the visible depth,
 * is never read in full.
 */
export async function getSuggestionThread(
  id: string,
  viewerId?: string | null,
  options: { sort?: CommentSort; focus?: string | null; comment?: string | null } = {},
): Promise<SuggestionThread | null> {
  const db = getDb();
  if (!db) return null;

  // Reached from the public suggestion thread page with no prior getSession() call.
  await ensureRoleCatalog();

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
    // thread keeps its shape; the tree keeps them as tombstones while a live
    // reply sits beneath.
    const rv = schema.suggestionReplyVotes;
    const shape: FlatComment[] = (
      await db
        .select({
          id: schema.suggestionReplies.id,
          parentId: schema.suggestionReplies.parentId,
          createdAt: schema.suggestionReplies.createdAt,
          deletedAt: schema.suggestionReplies.deletedAt,
          up: sql<number>`(select count(*) from ${rv} where ${rv.replyId} = ${schema.suggestionReplies.id} and ${rv.value} = 1)::int`,
          down: sql<number>`(select count(*) from ${rv} where ${rv.replyId} = ${schema.suggestionReplies.id} and ${rv.value} = -1)::int`,
        })
        .from(schema.suggestionReplies)
        .where(eq(schema.suggestionReplies.suggestionId, id))
        .orderBy(asc(schema.suggestionReplies.createdAt))
        .limit(MAX_THREAD_REPLIES)
    ).map((r) => ({
      id: r.id,
      parentId: r.parentId,
      createdAt: toIso(r.createdAt),
      deletedAt: toIsoOrNull(r.deletedAt),
      up: Number(r.up) || 0,
      down: Number(r.down) || 0,
    }));
    const tree = buildCommentTree(shape, options.sort ?? "best");
    const selected = selectCommentView(tree, {
      page: 1,
      perPage: null,
      focus: options.focus ?? null,
      comment: options.comment ?? null,
    });
    const replyIds = shownCommentIds(selected.nodes);

    const replyRows = replyIds.length
      ? await db
          .select({
            id: schema.suggestionReplies.id,
            authorId: schema.suggestionReplies.userId,
            body: schema.suggestionReplies.body,
            editedAt: schema.suggestionReplies.editedAt,
            deletedAt: schema.suggestionReplies.deletedAt,
            authorUsername: schema.profiles.username,
            authorDisplayName: schema.profiles.displayName,
            authorAvatarUrl: schema.profiles.avatarUrl,
            authorRole: sql<string | null>`(select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = ${schema.suggestionReplies.userId})`,
          })
          .from(schema.suggestionReplies)
          .leftJoin(schema.profiles, eq(schema.suggestionReplies.userId, schema.profiles.userId))
          .where(and(eq(schema.suggestionReplies.suggestionId, id), inArray(schema.suggestionReplies.id, replyIds)))
      : [];

    // One query for the view: the suggestion's own images plus every shown
    // live reply's, grouped in memory — no N+1.
    const liveReplyIds = replyRows.filter((r) => !r.deletedAt).map((r) => r.id);
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
        liveReplyIds.length
          ? or(
              eq(schema.suggestionImages.suggestionId, id),
              inArray(schema.suggestionImages.replyId, liveReplyIds),
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

    const myVotes =
      viewerId && replyIds.length
        ? await db.select({ replyId: rv.replyId, value: rv.value }).from(rv).where(and(eq(rv.userId, viewerId), inArray(rv.replyId, replyIds)))
        : [];
    const mineByReply = new Map(myVotes.map((r) => [r.replyId, r.value]));

    let hasVoted = false;
    if (viewerId) {
      const voteRows = await db
        .select({ id: schema.suggestionVotes.id })
        .from(schema.suggestionVotes)
        .where(and(eq(schema.suggestionVotes.suggestionId, id), eq(schema.suggestionVotes.userId, viewerId)))
        .limit(1);
      hasVoted = voteRows.length > 0;
    }

    // One lookup for the whole view: the suggestion's author plus every shown
    // reply author who has not chosen a profile avatar.
    const [providerAvatars, presence] = await Promise.all([
      providerAvatarsFor([
        row.authorAvatarUrl ? null : row.authorId,
        ...replyRows.filter((r) => !r.authorAvatarUrl).map((r) => r.authorId),
      ]),
      getPresenceFor(replyRows.map((r) => r.authorId)),
    ]);

    // Author ids are compared here and go no further: the page gets isOwn/isOp.
    const detailsById = new Map(replyRows.map((r) => [r.id, r]));
    const toReply = (reply: FlatComment): ThreadReply => {
      const r = detailsById.get(reply.id);
      const vote = mineByReply.get(reply.id);
      const authorId = r?.authorId ?? null;
      return {
        ...reply,
        isOwn: Boolean(authorId && viewerId && authorId === viewerId),
        isOp: Boolean(authorId && authorId === row.authorId),
        author: {
          username: r?.authorUsername || "community_member",
          displayName: r?.authorDisplayName || null,
          avatarUrl: r ? r.authorAvatarUrl || providerAvatars.get(r.authorId) || null : null,
        },
        authorRole: storedRole(r?.authorRole),
        // A removed reply's text and images must never reach the client: they
        // are serialised into the page payload even when the DOM shows a tombstone.
        body: reply.deletedAt ? "" : r?.body ?? "",
        editedAt: toIsoOrNull(r?.editedAt ?? null),
        images: reply.deletedAt ? [] : (imagesByReply.get(reply.id) ?? []),
        authorStatus: authorId ? presence.get(authorId) ?? null : null,
        myVote: vote === 1 || vote === -1 ? vote : 0,
      };
    };

    return {
      id: row.id,
      isOwn: Boolean(viewerId && row.authorId === viewerId),
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
      replies: mapCommentNodes(selected.nodes, toReply),
      totalReplies: countComments(tree),
      focusId: selected.focusId,
    };
  } catch (error) {
    console.error("Failed to load suggestion thread", error);
    return null;
  }
}

/** A stored app_metadata role as the rank the public sees (publicRole), or Member. normalizeRoleKey
 *  reads the legacy top-role key as web_dev until migration 055 (removable after). */
function storedRole(value: unknown): Role {
  const role = normalizeRoleKey(value);
  return isRoleKey(role) ? publicRole(role) : "member";
}
