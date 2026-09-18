import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { ROLES } from "@/lib/auth/roles";
import {
  buildCommentTree, countComments, selectCommentView,
  type CommentNode, type CommentSort, type FlatComment,
} from "@/lib/comments/tree";
import type { VoteValue } from "@/lib/comments/vote-rules";
import { getDb, schema } from "@/lib/db/client";
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
  authorId: string;
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
  // (see ReportButton) without re-deriving permissions in a Client Component.
  authorId: string;
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

export async function getSuggestionThread(
  id: string,
  viewerId?: string | null,
  options: { sort?: CommentSort; focus?: string | null; comment?: string | null } = {},
): Promise<SuggestionThread | null> {
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
        authorRole: sql<string | null>`(select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = ${schema.suggestionReplies.userId})`,
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

    const rv = schema.suggestionReplyVotes;
    const [voteTotals, myVotes] = replyIds.length
      ? await Promise.all([
          db
            .select({
              replyId: rv.replyId,
              up: sql<number>`(count(*) filter (where ${rv.value} = 1))::int`,
              down: sql<number>`(count(*) filter (where ${rv.value} = -1))::int`,
            })
            .from(rv)
            .where(inArray(rv.replyId, replyIds))
            .groupBy(rv.replyId),
          viewerId
            ? db.select({ replyId: rv.replyId, value: rv.value }).from(rv).where(and(eq(rv.userId, viewerId), inArray(rv.replyId, replyIds)))
            : Promise.resolve([] as { replyId: string; value: number }[]),
        ])
      : [[], []];
    const totalsByReply = new Map(voteTotals.map((row) => [row.replyId, row]));
    const mineByReply = new Map(myVotes.map((row) => [row.replyId, row.value]));

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
    const [providerAvatars, presence] = await Promise.all([
      providerAvatarsFor([
        row.authorAvatarUrl ? null : row.authorId,
        ...replyRows.filter((r) => !r.authorAvatarUrl).map((r) => r.authorId),
      ]),
      getPresenceFor(replyRows.map((r) => r.authorId)),
    ]);

    const flatReplies: ThreadReply[] = replyRows.map((r) => {
      const counted = totalsByReply.get(r.id);
      const vote = mineByReply.get(r.id);
      return {
        id: r.id,
        parentId: r.parentId,
        authorId: r.authorId,
        author: {
          username: r.authorUsername || "community_member",
          displayName: r.authorDisplayName || null,
          avatarUrl: r.authorAvatarUrl || providerAvatars.get(r.authorId) || null,
        },
        authorRole: ROLES.includes(r.authorRole as Role) ? (r.authorRole as Role) : "member",
        // A removed reply's text and images must never reach the client: they
        // are serialised into the page payload even when the DOM shows a tombstone.
        body: r.deletedAt ? "" : r.body,
        createdAt: toIso(r.createdAt),
        editedAt: toIsoOrNull(r.editedAt),
        deletedAt: toIsoOrNull(r.deletedAt),
        images: r.deletedAt ? [] : (imagesByReply.get(r.id) ?? []),
        authorStatus: presence.get(r.authorId) ?? null,
        up: counted?.up ?? 0,
        down: counted?.down ?? 0,
        myVote: vote === 1 || vote === -1 ? vote : 0,
      };
    });
    const tree = buildCommentTree(flatReplies, options.sort ?? "best");
    const selected = selectCommentView(tree, {
      page: 1,
      perPage: null,
      focus: options.focus ?? null,
      comment: options.comment ?? null,
    });

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
      replies: selected.nodes,
      totalReplies: countComments(tree),
      focusId: selected.focusId,
    };
  } catch (error) {
    console.error("Failed to load suggestion thread", error);
    return null;
  }
}
