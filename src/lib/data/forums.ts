import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { DELETED_AUTHOR, POSTS_PER_PAGE, TOPICS_PER_PAGE, type ForumActor } from "@/lib/forums-rules";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, FORUMS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { isRoleKey, normalizeRoleKey, publicRole } from "@/lib/auth/roles";
import { ensureRoleCatalog } from "@/lib/data/roles";
import { getPresenceFor } from "@/lib/data/presence";
import { providerAvatarsFor } from "@/lib/data/provider-avatars";
import type { PresenceShown } from "@/lib/presence-rules";
import type { Role } from "@/lib/types";
import {
  buildCommentTree, countComments, MAX_VISIBLE_DEPTH, selectCommentView,
  type CommentNode, type CommentSort, type FlatComment,
} from "@/lib/comments/tree";
import type { VoteValue } from "@/lib/comments/vote-rules";

export interface PostForEdit {
  postId: string;
  authorId: string;
  deletedAt: string | null;
  topicId: string;
  topicAuthorId: string;
  topicTitle: string;
  topicLocked: boolean;
  topicDeletedAt: string | null;
  forumLocked: boolean;
  forumSlug: string;
}

/**
 * One post plus the topic and forum state every write rule needs.
 *
 * The rules take forum, topic and post together, so fetching them separately
 * would be three round trips and three chances for the three to disagree.
 */
export async function getPostForEdit(postId: string): Promise<PostForEdit | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({
        postId: schema.forumPosts.id,
        authorId: schema.forumPosts.userId,
        deletedAt: schema.forumPosts.deletedAt,
        topicId: schema.forumTopics.id,
        topicAuthorId: schema.forumTopics.userId,
        topicTitle: schema.forumTopics.title,
        topicLocked: schema.forumTopics.locked,
        topicDeletedAt: schema.forumTopics.deletedAt,
        forumLocked: schema.forums.locked,
        forumSlug: schema.forums.slug,
      })
      .from(schema.forumPosts)
      .innerJoin(schema.forumTopics, eq(schema.forumTopics.id, schema.forumPosts.topicId))
      .innerJoin(schema.forums, eq(schema.forums.id, schema.forumTopics.forumId))
      .where(eq(schema.forumPosts.id, postId))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
      topicDeletedAt: row.topicDeletedAt ? new Date(row.topicDeletedAt).toISOString() : null,
    };
  } catch {
    return null;
  }
}

export interface BoardForum {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  locked: boolean;
  topicCount: number;
  postCount: number;
  lastPost: { topicId: string; topicTitle: string; author: string; at: string } | null;
}

export interface BoardCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  forums: BoardForum[];
}

/**
 * The whole board in two queries.
 *
 * Counts are computed rather than stored. Counter columns drift the first time
 * a delete or a rolled-back transaction misses an update, and then no number on
 * the page can be trusted; a grouped query cannot disagree with the rows it
 * counts. The soft-delete filters live in the JOIN conditions, not the WHERE,
 * so a forum with only deleted topics still returns a row reading zero rather
 * than vanishing from the board.
 */
export async function getForumBoard(): Promise<BoardCategory[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        categoryId: schema.forumCategories.id,
        categoryName: schema.forumCategories.name,
        categorySlug: schema.forumCategories.slug,
        categoryDescription: schema.forumCategories.description,
        categorySort: schema.forumCategories.sortOrder,
        forumId: schema.forums.id,
        forumName: schema.forums.name,
        forumSlug: schema.forums.slug,
        forumDescription: schema.forums.description,
        forumIcon: schema.forums.icon,
        forumLocked: schema.forums.locked,
        forumSort: schema.forums.sortOrder,
        topicCount: sql<number>`count(distinct ${schema.forumTopics.id})::int`,
        postCount: sql<number>`count(${schema.forumPosts.id})::int`,
      })
      .from(schema.forumCategories)
      .leftJoin(schema.forums, eq(schema.forums.categoryId, schema.forumCategories.id))
      .leftJoin(
        schema.forumTopics,
        and(eq(schema.forumTopics.forumId, schema.forums.id), isNull(schema.forumTopics.deletedAt)),
      )
      .leftJoin(
        schema.forumPosts,
        and(eq(schema.forumPosts.topicId, schema.forumTopics.id), isNull(schema.forumPosts.deletedAt)),
      )
      .groupBy(
        schema.forumCategories.id,
        schema.forumCategories.name,
        schema.forumCategories.slug,
        schema.forumCategories.description,
        schema.forumCategories.sortOrder,
        schema.forums.id,
        schema.forums.name,
        schema.forums.slug,
        schema.forums.description,
        schema.forums.icon,
        schema.forums.locked,
        schema.forums.sortOrder,
      )
      .orderBy(asc(schema.forumCategories.sortOrder), asc(schema.forums.sortOrder));

    const lastPosts = await lastPostByForum();

    const byCategory = new Map<string, BoardCategory>();
    for (const row of rows) {
      let category = byCategory.get(row.categoryId);
      if (!category) {
        category = {
          id: row.categoryId,
          name: row.categoryName,
          slug: row.categorySlug,
          description: row.categoryDescription,
          forums: [],
        };
        byCategory.set(row.categoryId, category);
      }
      // A category with no forums still produces one row, with null forum columns.
      if (!row.forumId || !row.forumSlug || !row.forumName) continue;
      category.forums.push({
        id: row.forumId,
        name: row.forumName,
        slug: row.forumSlug,
        description: row.forumDescription,
        icon: row.forumIcon,
        locked: row.forumLocked ?? false,
        topicCount: row.topicCount,
        postCount: row.postCount,
        lastPost: lastPosts.get(row.forumId) ?? null,
      });
    }
    return [...byCategory.values()];
  } catch {
    return [];
  }
}

/** Newest live post per forum, with its topic and author, in one pass. */
async function lastPostByForum(): Promise<Map<string, NonNullable<BoardForum["lastPost"]>>> {
  const db = getDb();
  const found = new Map<string, NonNullable<BoardForum["lastPost"]>>();
  if (!db) return found;

  const result = await db.execute(sql`
    select distinct on (t.forum_id)
      t.forum_id   as forum_id,
      t.id         as topic_id,
      t.title      as topic_title,
      coalesce(pr.display_name, pr.username) as author,
      p.created_at as at
    from forum_posts p
    join forum_topics t on t.id = p.topic_id and t.deleted_at is null
    left join profiles pr on pr.user_id = p.user_id
    where p.deleted_at is null
    order by t.forum_id, p.created_at desc
  `);

  for (const row of result as Array<Record<string, unknown>>) {
    found.set(String(row.forum_id), {
      topicId: String(row.topic_id),
      topicTitle: String(row.topic_title),
      author: String(row.author ?? "Unknown"),
      at: new Date(row.at as string).toISOString(),
    });
  }
  return found;
}

export interface ForumHeader {
  id: string; name: string; slug: string; description: string | null;
  locked: boolean; categoryName: string; categorySlug: string;
}

export interface TopicRow {
  id: string; title: string; pinned: boolean; locked: boolean;
  author: string; authorUsername: string; authorAvatar: string | null;
  replyCount: number; lastPostAt: string;
}

export async function getForumBySlug(slug: string): Promise<ForumHeader | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({
        id: schema.forums.id, name: schema.forums.name, slug: schema.forums.slug,
        description: schema.forums.description, locked: schema.forums.locked,
        categoryName: schema.forumCategories.name, categorySlug: schema.forumCategories.slug,
      })
      .from(schema.forums)
      .innerJoin(schema.forumCategories, eq(schema.forumCategories.id, schema.forums.categoryId))
      .where(eq(schema.forums.slug, slug))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/*
  A topic's opening post is its earliest post, removed or not — the same rule
  deletePostAction uses. Its author can remove it while the discussion stays
  up, so the topic lists need to know whether it is gone.
*/
const openingPostId = sql`(
  select fp.id from ${schema.forumPosts} fp
  where fp.topic_id = ${schema.forumTopics.id}
  order by fp.created_at limit 1
)`;
const openingPostRemoved = sql<boolean>`coalesce((
  select fp.deleted_at is not null from ${schema.forumPosts} fp
  where fp.topic_id = ${schema.forumTopics.id}
  order by fp.created_at limit 1
), false)`;

/** Pinned first, then most recently posted in. Reply count excludes the opening post. */
export async function getTopics(forumId: string, page: number): Promise<{ topics: TopicRow[]; total: number }> {
  const db = getDb();
  if (!db) return { topics: [], total: 0 };
  const offset = Math.max(0, page - 1) * TOPICS_PER_PAGE;

  try {
    const rows = await db
      .select({
        id: schema.forumTopics.id,
        title: schema.forumTopics.title,
        pinned: schema.forumTopics.pinned,
        locked: schema.forumTopics.locked,
        lastPostAt: schema.forumTopics.lastPostAt,
        author: sql<string>`coalesce(${schema.profiles.displayName}, ${schema.profiles.username})`,
        authorId: schema.forumTopics.userId,
        authorUsername: schema.profiles.username,
        authorAvatar: schema.profiles.avatarUrl,
        // Live posts other than the opening post: right whether or not the opening post is still up.
        replyCount: sql<number>`(count(${schema.forumPosts.id}) filter (where ${schema.forumPosts.id} <> ${openingPostId}))::int`,
        openingRemoved: openingPostRemoved,
      })
      .from(schema.forumTopics)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.forumTopics.userId))
      .leftJoin(
        schema.forumPosts,
        and(eq(schema.forumPosts.topicId, schema.forumTopics.id), isNull(schema.forumPosts.deletedAt)),
      )
      .where(and(eq(schema.forumTopics.forumId, forumId), isNull(schema.forumTopics.deletedAt)))
      .groupBy(
        schema.forumTopics.id, schema.forumTopics.title, schema.forumTopics.pinned,
        schema.forumTopics.locked, schema.forumTopics.lastPostAt, schema.forumTopics.userId,
        schema.profiles.displayName, schema.profiles.username, schema.profiles.avatarUrl,
      )
      .orderBy(desc(schema.forumTopics.pinned), desc(schema.forumTopics.lastPostAt))
      .limit(TOPICS_PER_PAGE)
      .offset(offset);

    const [totals] = await db
      .select({ total: count() })
      .from(schema.forumTopics)
      .where(and(eq(schema.forumTopics.forumId, forumId), isNull(schema.forumTopics.deletedAt)));

    // Someone who signed in with Discord or Google and never chose an avatar has
    // profiles.avatar_url null, yet the header shows their provider photo. Without
    // this the same person is a monogram here and a photo there.
    const providerAvatars = await providerAvatarsFor(rows.filter((row) => !row.authorAvatar).map((row) => row.authorId));

    return {
      topics: rows.map((row) =>
        // An author who removed their opening post is not named on the discussion it started.
        row.openingRemoved
          ? {
              id: row.id,
              title: row.title,
              pinned: row.pinned,
              locked: row.locked,
              author: DELETED_AUTHOR,
              authorUsername: DELETED_AUTHOR,
              authorAvatar: null,
              replyCount: row.replyCount,
              lastPostAt: new Date(row.lastPostAt).toISOString(),
            }
          : {
              id: row.id,
              title: row.title,
              pinned: row.pinned,
              locked: row.locked,
              author: row.author ?? "Unknown",
              authorUsername: row.authorUsername ?? "member",
              authorAvatar: row.authorAvatar ?? providerAvatars.get(row.authorId) ?? null,
              replyCount: row.replyCount,
              lastPostAt: new Date(row.lastPostAt).toISOString(),
            },
      ),
      total: totals?.total ?? 0,
    };
  } catch {
    return { topics: [], total: 0 };
  }
}

export interface TopicHeader {
  id: string; title: string; locked: boolean; pinned: boolean;
  forumName: string; forumSlug: string; forumLocked: boolean;
  categoryName: string; author: string; createdAt: string;
  /** The author deleted their opening post; the discussion stays up without their name on it. */
  openingRemoved: boolean;
}

export interface ForumPostImage { id: string; url: string; sortOrder: number }

export async function getTopic(topicId: string): Promise<TopicHeader | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({
        id: schema.forumTopics.id, title: schema.forumTopics.title,
        locked: schema.forumTopics.locked, pinned: schema.forumTopics.pinned,
        forumName: schema.forums.name, forumSlug: schema.forums.slug,
        forumLocked: schema.forums.locked, categoryName: schema.forumCategories.name,
        author: sql<string | null>`coalesce(${schema.profiles.displayName}, ${schema.profiles.username})`,
        createdAt: schema.forumTopics.createdAt,
        openingRemoved: openingPostRemoved,
      })
      .from(schema.forumTopics)
      .innerJoin(schema.forums, eq(schema.forums.id, schema.forumTopics.forumId))
      .innerJoin(schema.forumCategories, eq(schema.forumCategories.id, schema.forums.categoryId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.forumTopics.userId))
      .where(and(eq(schema.forumTopics.id, topicId), isNull(schema.forumTopics.deletedAt)))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      author: row.openingRemoved ? DELETED_AUTHOR : row.author ?? "Unknown",
      createdAt: new Date(row.createdAt).toISOString(),
      openingRemoved: Boolean(row.openingRemoved),
    };
  } catch {
    return null;
  }
}

export interface ForumComment extends FlatComment {
  body: string;
  editedAt: string | null;
  /**
   * The viewer wrote this post. Sent instead of the author's auth id, which
   * never leaves the loader: the page only needs to know whose post it is
   * relative to the person looking.
   */
  isOwn: boolean;
  /** Written by the topic's author. */
  isOp: boolean;
  author: string;
  authorAvatar: string | null;
  /** From auth app_metadata, like every session's role — profiles.role is stale. */
  authorRole: Role;
  /** Always empty for a removed post, so its images never reach the page. */
  images: ForumPostImage[];
  /** The author's website status, absent when they are offline or invisible. */
  authorStatus: Exclude<PresenceShown, "offline"> | null;
  myVote: VoteValue;
}

export interface TopicComments {
  opening: ForumComment | null;
  nodes: CommentNode<ForumComment>[];
  totalComments: number;
  pages: number;
  page: number;
  focusId: string | null;
}

/**
 * Ceiling on the posts one topic page reads. Far above any real discussion
 * here; it exists so a flooded topic cannot turn one page view into an
 * unbounded read. Posts past it (the newest) are not shown.
 */
export const MAX_TOPIC_POSTS = 2000;

/**
 * A topic's opening post and its comment tree.
 *
 * Read in two steps. First the thread's shape — ids, parents, timestamps and
 * vote totals, no text — which is all the shared comment engine needs to build,
 * sort and paginate the tree. Pages count top-level comments after sorting, so
 * a thread never splits across pages, and "best" ranks on vote totals; neither
 * maps onto a plain SQL OFFSET, so the shape is paged in memory. Then bodies,
 * authors, images, presence and the viewer's votes are read only for the posts
 * this page shows. The opening post is kept out of the tree: it is the topic,
 * shown above the comments.
 *
 * `comment` (a shared link) overrides `page` and `focus`: the page is the one
 * holding the comment's top-level ancestor, and a comment deeper than the
 * visible depth opens the focused view that shows it.
 */
export async function getTopicComments(
  topicId: string,
  options: { sort: CommentSort; page: number; focus?: string | null; comment?: string | null; viewerId: string | null },
): Promise<TopicComments> {
  const empty: TopicComments = { opening: null, nodes: [], totalComments: 0, pages: 1, page: 1, focusId: null };
  const db = getDb();
  if (!db) return empty;

  // Reached from the public forum topic page with no prior getSession() call.
  await ensureRoleCatalog();

  try {
    const v = schema.forumPostVotes;
    const shape: FlatComment[] = (
      await db
        .select({
          id: schema.forumPosts.id, parentId: schema.forumPosts.parentId,
          createdAt: schema.forumPosts.createdAt, deletedAt: schema.forumPosts.deletedAt,
          up: sql<number>`(select count(*) from ${v} where ${v.postId} = ${schema.forumPosts.id} and ${v.value} = 1)::int`,
          down: sql<number>`(select count(*) from ${v} where ${v.postId} = ${schema.forumPosts.id} and ${v.value} = -1)::int`,
        })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.topicId, topicId))
        .orderBy(asc(schema.forumPosts.createdAt))
        .limit(MAX_TOPIC_POSTS)
    ).map((row) => ({
      id: row.id,
      parentId: row.parentId,
      createdAt: new Date(row.createdAt).toISOString(),
      deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
      up: Number(row.up) || 0,
      down: Number(row.down) || 0,
    }));
    if (shape.length === 0) return empty;

    // The earliest post is the opening post, removed or not — the same rule deletePostAction uses.
    const [openingShape, ...replies] = shape;
    // Replies to the opening post are top-level comments.
    const tree = buildCommentTree(
      replies.map((reply) => (reply.parentId === openingShape.id ? { ...reply, parentId: null } : reply)),
      options.sort,
    );
    const totalComments = countComments(tree);
    const selected = selectCommentView(tree, {
      page: options.page,
      perPage: POSTS_PER_PAGE,
      focus: options.focus ?? null,
      comment: options.comment ?? null,
    });

    const ids = [openingShape.id, ...shownCommentIds(selected.nodes)];
    const [rows, topicRows, mine] = await Promise.all([
      db
        .select({
          id: schema.forumPosts.id, body: schema.forumPosts.body, editedAt: schema.forumPosts.editedAt,
          deletedAt: schema.forumPosts.deletedAt, authorId: schema.forumPosts.userId,
          author: sql<string | null>`coalesce(${schema.profiles.displayName}, ${schema.profiles.username})`,
          authorAvatar: schema.profiles.avatarUrl,
          authorRole: sql<string | null>`(select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = ${schema.forumPosts.userId})`,
        })
        .from(schema.forumPosts)
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.forumPosts.userId))
        .where(and(eq(schema.forumPosts.topicId, topicId), inArray(schema.forumPosts.id, ids))),
      db
        .select({ authorId: schema.forumTopics.userId })
        .from(schema.forumTopics)
        .where(eq(schema.forumTopics.id, topicId))
        .limit(1),
      options.viewerId
        ? db.select({ postId: v.postId, value: v.value }).from(v).where(and(eq(v.userId, options.viewerId), inArray(v.postId, ids)))
        : Promise.resolve([] as { postId: string; value: number }[]),
    ]);
    const topicAuthorId = topicRows[0]?.authorId ?? null;

    const liveIds = rows.filter((row) => !row.deletedAt).map((row) => row.id);
    const [imageRows, providerAvatars, presence] = await Promise.all([
      liveIds.length
        ? db
            .select({
              id: schema.forumPostImages.id, postId: schema.forumPostImages.postId,
              url: schema.forumPostImages.url, sortOrder: schema.forumPostImages.sortOrder,
            })
            .from(schema.forumPostImages)
            .where(inArray(schema.forumPostImages.postId, liveIds))
            .orderBy(asc(schema.forumPostImages.sortOrder))
        : Promise.resolve([]),
      providerAvatarsFor(rows.filter((row) => !row.authorAvatar).map((row) => row.authorId)),
      getPresenceFor(rows.map((row) => row.authorId)),
    ]);
    const detailsById = new Map(rows.map((row) => [row.id, row]));
    const mineByPost = new Map(mine.map((row) => [row.postId, row.value]));
    const imagesByPost = new Map<string, ForumPostImage[]>();
    for (const { postId, ...image } of imageRows) {
      imagesByPost.set(postId, [...(imagesByPost.get(postId) ?? []), image]);
    }

    // The author's id is compared here and goes no further.
    const toComment = (post: FlatComment): ForumComment => {
      const row = detailsById.get(post.id);
      const vote = mineByPost.get(post.id);
      const authorId = row?.authorId ?? null;
      return {
        ...post,
        body: row?.body ?? "",
        editedAt: row?.editedAt ? new Date(row.editedAt).toISOString() : null,
        isOwn: Boolean(authorId && options.viewerId && authorId === options.viewerId),
        isOp: Boolean(authorId && topicAuthorId && authorId === topicAuthorId),
        author: row?.author ?? "Unknown",
        authorAvatar: row ? row.authorAvatar ?? providerAvatars.get(row.authorId) ?? null : null,
        authorRole: storedRole(row?.authorRole),
        images: post.deletedAt ? [] : imagesByPost.get(post.id) ?? [],
        authorStatus: authorId ? presence.get(authorId) ?? null : null,
        myVote: vote === 1 || vote === -1 ? vote : 0,
      };
    };

    return {
      opening: toComment(openingShape),
      nodes: mapCommentNodes(selected.nodes, toComment),
      totalComments,
      pages: selected.pages,
      page: selected.page,
      focusId: selected.focusId,
    };
  } catch (error) {
    console.error("getTopicComments failed", error);
    return empty;
  }
}

/**
 * Ids of the comments a view renders. Below MAX_VISIBLE_DEPTH the page links
 * to a focused view instead of rendering children, so their text is not read.
 */
export function shownCommentIds(nodes: readonly CommentNode<FlatComment>[]): string[] {
  return nodes.flatMap((node) => [
    node.comment.id,
    ...(node.depth >= MAX_VISIBLE_DEPTH ? [] : shownCommentIds(node.children)),
  ]);
}

/** The same tree with each comment swapped for its full form; depths and counts unchanged. */
export function mapCommentNodes<T extends FlatComment, U extends FlatComment>(
  nodes: readonly CommentNode<T>[],
  map: (comment: T) => U,
): CommentNode<U>[] {
  return nodes.map((node) => ({
    ...node,
    comment: map(node.comment),
    children: node.depth >= MAX_VISIBLE_DEPTH ? [] : mapCommentNodes(node.children, map),
  }));
}

/**
 * The viewing actor, for deciding what a page RENDERS.
 *
 * Every action re-derives this server-side before writing, so this is only ever
 * used to hide controls the viewer cannot use — never as the gate itself.
 */
export async function getViewerActor(): Promise<ForumActor> {
  const guest: ForumActor = { userId: null, role: null, accountStatus: null, canModerate: false };
  try {
    const session = await getSession();
    if (!session) return guest;

    const userId = await getSessionUserId();
    const db = getDb();
    let accountStatus: string | null = null;
    if (db && userId) {
      const [profile] = await db
        .select({ accountStatus: schema.profiles.accountStatus })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, userId))
        .limit(1);
      accountStatus = profile?.accountStatus ?? null;
    }

    return {
      userId,
      role: session.role,
      accountStatus,
      canModerate: await canManageModule(FORUMS_PERMISSION_KEY, session, userId),
    };
  } catch {
    return guest;
  }
}

/** A stored app_metadata role as the rank the public sees (publicRole), or Member. normalizeRoleKey
 *  reads the legacy top-role key as web_dev until migration 055 (removable after). */
function storedRole(value: unknown): Role {
  const role = normalizeRoleKey(value);
  return isRoleKey(role) ? publicRole(role) : "member";
}
