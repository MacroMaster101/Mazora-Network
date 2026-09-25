"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, FORUMS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit-log";
import { getPostForEdit } from "@/lib/data/forums";
import { attachForumPostImages, removeForumPostImages } from "@/lib/forums/image-store";
import { dispatchForumReplyNotification } from "@/lib/forums/notify";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import { REPORT_REASONS, type ReportReason } from "@/lib/report-rules";
import { attachmentCountError, filesFromFormData, imageSizeError, urlsFromFormData } from "@/lib/suggestion-image-rules";
import {
  BODY_MAX, canCreateTopic, canDeletePost, canEditPost, canReply, canReportPost, isValidTitle,
  openingDeleteRemovesTopic, purgeableImagePosts, REPORT_NOTE_MAX, type ForumActor,
} from "@/lib/forums-rules";
import { canVoteOnComment, COMMENT_VOTES_PER_MINUTE, isVoteValue, type VoteValue } from "@/lib/comments/vote-rules";

export interface ForumActionResult {
  ok: boolean;
  message: string;
  /** Set on a successful topic creation so the caller can navigate to it. */
  topicId?: string;
  /** Set when deleting the opening post removed its whole topic. */
  topicRemoved?: boolean;
  /** The forum to send the viewer back to when `topicRemoved` is set. */
  forumSlug?: string;
}

const idSchema = z.string().uuid();

/**
 * The images a post form carries, checked before anything is written so a
 * member never sees "rejected" for a post that actually landed. Same fields
 * and limits as the suggestions composer, whose picker the forum reuses.
 */
function readAttachments(formData: FormData): { files: File[]; urls: string[] } | { error: string } {
  const files = filesFromFormData(formData, "images");
  const urls = urlsFromFormData(formData, "imageUrls");
  const countError = attachmentCountError(files.length, urls.length);
  if (countError) return { error: countError };
  for (const file of files) {
    const sizeError = imageSizeError(file.size);
    if (sizeError) return { error: sizeError };
  }
  return { files, urls };
}

/**
 * The actor every rule is evaluated against.
 *
 * `accountStatus` comes from the profiles row rather than the session, because
 * a suspension must take effect on the next action rather than the next
 * sign-in — a suspended member keeps their cookie.
 */
async function currentActor(): Promise<{ actor: ForumActor; userId: string; username: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const userId = await getSessionUserId();
  if (!userId) return null;

  const db = getDb();
  if (!db) return null;
  const [profile] = await db
    .select({ accountStatus: schema.profiles.accountStatus })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);

  return {
    userId,
    actor: {
      userId,
      role: session.role,
      accountStatus: profile?.accountStatus ?? null,
      canModerate: await canManageModule(FORUMS_PERMISSION_KEY, session, userId),
    },
    username: session.displayName || session.username,
  };
}

export async function createTopicAction(formData: FormData): Promise<ForumActionResult> {
  const me = await currentActor();
  if (!me) return { ok: false, message: "You must be signed in to post." };

  const forumId = String(formData.get("forumId") ?? "");
  if (!idSchema.safeParse(forumId).success) return { ok: false, message: "Unknown forum." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!isValidTitle(title)) return { ok: false, message: "Titles must be 3–140 characters." };
  if (body.length === 0) return { ok: false, message: "Your post must not be empty." };
  if (body.length > BODY_MAX) {
    return { ok: false, message: `Your post is too long (${BODY_MAX} characters maximum).` };
  }

  const attachments = readAttachments(formData);
  if ("error" in attachments) return { ok: false, message: attachments.error };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  // The forum's state is read from the database, never from the form.
  const [forum] = await db
    .select({ id: schema.forums.id, slug: schema.forums.slug, locked: schema.forums.locked })
    .from(schema.forums)
    .where(eq(schema.forums.id, forumId))
    .limit(1);
  if (!forum) return { ok: false, message: "Unknown forum." };
  if (!canCreateTopic({ locked: forum.locked }, me.actor)) {
    return { ok: false, message: "You cannot start a topic in this forum." };
  }

  const limit = await rateLimitShared(await actionClientKey("forum-topic", me.userId), {
    limit: 5,
    windowMs: 60_000,
  });
  if (!limit.ok) return { ok: false, message: "You're posting too fast. Wait a moment and try again." };

  try {
    // The topic and its opening post are one unit — a topic with no post would
    // render as an empty thread and count as a reply of −1.
    const { topicId, postId } = await db.transaction(async (tx) => {
      const [topic] = await tx
        .insert(schema.forumTopics)
        .values({ forumId: forum.id, userId: me.userId, title })
        .returning({ id: schema.forumTopics.id });
      const [post] = await tx
        .insert(schema.forumPosts)
        .values({ topicId: topic.id, userId: me.userId, body })
        .returning({ id: schema.forumPosts.id });
      return { topicId: topic.id, postId: post.id };
    });

    // After the commit: an attachment problem never un-posts the topic.
    await attachForumPostImages(postId, me.userId, attachments.files, attachments.urls);

    revalidatePath("/forums");
    revalidatePath(`/forums/${forum.slug}`);
    return { ok: true, message: "Topic posted.", topicId };
  } catch (error) {
    console.error("Failed to create forum topic", error);
    return { ok: false, message: "Your topic could not be posted. Please try again." };
  }
}

export async function createPostAction(formData: FormData): Promise<ForumActionResult> {
  const me = await currentActor();
  if (!me) return { ok: false, message: "You must be signed in to reply." };

  const topicId = String(formData.get("topicId") ?? "");
  if (!idSchema.safeParse(topicId).success) return { ok: false, message: "That topic no longer exists." };

  const body = String(formData.get("body") ?? "").trim();
  if (body.length === 0) return { ok: false, message: "Your reply must not be empty." };
  if (body.length > BODY_MAX) {
    return { ok: false, message: `Your reply is too long (${BODY_MAX} characters maximum).` };
  }

  const attachments = readAttachments(formData);
  if ("error" in attachments) return { ok: false, message: attachments.error };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [topic] = await db
    .select({
      id: schema.forumTopics.id,
      title: schema.forumTopics.title,
      authorId: schema.forumTopics.userId,
      locked: schema.forumTopics.locked,
      deletedAt: schema.forumTopics.deletedAt,
      forumLocked: schema.forums.locked,
    })
    .from(schema.forumTopics)
    .innerJoin(schema.forums, eq(schema.forums.id, schema.forumTopics.forumId))
    .where(eq(schema.forumTopics.id, topicId))
    .limit(1);
  if (!topic) return { ok: false, message: "That topic no longer exists." };

  const topicState = {
    locked: topic.locked,
    deletedAt: topic.deletedAt ? new Date(topic.deletedAt).toISOString() : null,
  };
  if (!canReply({ locked: topic.forumLocked }, topicState, me.actor)) {
    return { ok: false, message: "This topic is not accepting replies." };
  }

  const limit = await rateLimitShared(await actionClientKey("forum-post", me.userId), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.ok) return { ok: false, message: "You're replying too fast. Wait a moment and try again." };

  // The post being answered is looked up, never trusted: it must belong to
  // this topic and still be live. The reply attaches directly to it, at any
  // depth. Answering the opening post is answering the topic, so that reply is
  // top-level.
  let parentId: string | null = null;
  let answeredAuthorId: string | null = null;
  const replyTo = String(formData.get("replyTo") ?? "");
  if (replyTo) {
    if (!idSchema.safeParse(replyTo).success) return { ok: false, message: "That post is no longer available." };
    const [[target], [opening]] = await Promise.all([
      db
        .select({
          id: schema.forumPosts.id, topicId: schema.forumPosts.topicId,
          deletedAt: schema.forumPosts.deletedAt, authorId: schema.forumPosts.userId,
        })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, replyTo))
        .limit(1),
      db
        .select({ id: schema.forumPosts.id })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.topicId, topic.id))
        .orderBy(asc(schema.forumPosts.createdAt))
        .limit(1),
    ]);
    if (!target || target.topicId !== topic.id || target.deletedAt) {
      return { ok: false, message: "That post is no longer available." };
    }
    if (target.id !== opening?.id) {
      parentId = target.id;
      answeredAuthorId = target.authorId;
    }
  }

  let postId: string;
  try {
    postId = await db.transaction(async (tx) => {
      const [post] = await tx
        .insert(schema.forumPosts)
        .values({ topicId: topic.id, parentId, userId: me.userId, body })
        .returning({ id: schema.forumPosts.id });
      // last_post_at orders every topic list, so it moves with the post itself.
      await tx
        .update(schema.forumTopics)
        .set({ lastPostAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.forumTopics.id, topic.id));
      return post.id;
    });
  } catch (error) {
    console.error("Failed to post forum reply", error);
    return { ok: false, message: "Your reply could not be posted. Please try again." };
  }

  await attachForumPostImages(postId, me.userId, attachments.files, attachments.urls);

  // Best-effort and after the commit: dispatch swallows its own errors, so a
  // notification failure can never fail a reply that already landed.
  const notice = { replierId: me.userId, topicId: topic.id, topicTitle: topic.title, replierName: me.username };
  await dispatchForumReplyNotification({ ...notice, authorId: topic.authorId });
  // A nested reply also tells the person answered, unless that is the topic's
  // author, who was just notified.
  if (answeredAuthorId && answeredAuthorId !== topic.authorId) {
    await dispatchForumReplyNotification({ ...notice, authorId: answeredAuthorId, target: "post" });
  }

  revalidatePath(`/forums/topic/${topic.id}`);
  revalidatePath("/forums");
  return { ok: true, message: "Reply posted." };
}

export async function editPostAction(formData: FormData): Promise<ForumActionResult> {
  const me = await currentActor();
  if (!me) return { ok: false, message: "You must be signed in to edit." };

  const postId = String(formData.get("postId") ?? "");
  if (!idSchema.safeParse(postId).success) return { ok: false, message: "That post no longer exists." };

  const body = String(formData.get("body") ?? "").trim();
  if (body.length === 0) return { ok: false, message: "Your post must not be empty." };
  if (body.length > BODY_MAX) {
    return { ok: false, message: `Your post is too long (${BODY_MAX} characters maximum).` };
  }

  const target = await getPostForEdit(postId);
  if (!target) return { ok: false, message: "That post no longer exists." };

  const allowed = canEditPost(
    { locked: target.forumLocked },
    { locked: target.topicLocked, deletedAt: target.topicDeletedAt },
    { authorId: target.authorId, deletedAt: target.deletedAt },
    me.actor,
  );
  if (!allowed) return { ok: false, message: "You cannot edit this post." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    // editedAt is set permanently — an edit is never silent. The deletedAt
    // check guards against a delete that lands between the read above and
    // this write — an edit must never resurrect a post someone just removed.
    const updated = await db
      .update(schema.forumPosts)
      .set({ body, editedAt: new Date() })
      .where(and(eq(schema.forumPosts.id, postId), isNull(schema.forumPosts.deletedAt)))
      .returning({ id: schema.forumPosts.id });
    if (!updated.length) return { ok: false, message: "That post no longer exists." };
    revalidatePath(`/forums/topic/${target.topicId}`);
    return { ok: true, message: "Post updated." };
  } catch {
    return { ok: false, message: "That post could not be updated." };
  }
}

/** Whether one post still has a report staff have not closed. */
async function hasOpenReport(db: NonNullable<ReturnType<typeof getDb>>, postId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.forumReports.id })
    .from(schema.forumReports)
    .where(and(eq(schema.forumReports.postId, postId), eq(schema.forumReports.status, "open")))
    .limit(1);
  return Boolean(row);
}

export async function deletePostAction(postId: string): Promise<ForumActionResult> {
  const me = await currentActor();
  if (!me) return { ok: false, message: "You must be signed in." };
  if (!idSchema.safeParse(postId).success) return { ok: false, message: "That post no longer exists." };

  const target = await getPostForEdit(postId);
  if (!target) return { ok: false, message: "That post no longer exists." };

  if (target.topicDeletedAt) return { ok: false, message: "That topic has been removed." };

  if (!canDeletePost({ authorId: target.authorId, deletedAt: target.deletedAt }, me.actor)) {
    return { ok: false, message: "You cannot remove this post." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    const now = new Date();
    // The opening-post lookup runs inside the same transaction as the delete,
    // through `tx`, so nothing else can remove or reorder posts between the
    // read and the write it decides. It considers every post regardless of
    // deleted state: the earliest post is the opening post whether or not it
    // — or a later one — has already been soft-deleted.
    const { isOpeningPost, removedTopic } = await db.transaction(async (tx) => {
      const [first] = await tx
        .select({ id: schema.forumPosts.id })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.topicId, target.topicId))
        .orderBy(schema.forumPosts.createdAt)
        .limit(1);

      await tx.update(schema.forumPosts).set({ deletedAt: now }).where(eq(schema.forumPosts.id, postId));
      if (first?.id !== postId) return { isOpeningPost: false, removedTopic: false };

      // A live reply by anyone other than the author is a discussion worth keeping.
      const [otherReply] = await tx
        .select({ id: schema.forumPosts.id })
        .from(schema.forumPosts)
        .where(
          and(
            eq(schema.forumPosts.topicId, target.topicId),
            ne(schema.forumPosts.userId, target.authorId),
            isNull(schema.forumPosts.deletedAt),
          ),
        )
        .limit(1);
      const removesTopic = openingDeleteRemovesTopic({
        actorIsAuthor: me.userId === target.authorId,
        othersReplied: Boolean(otherReply),
      });
      if (removesTopic) {
        await tx.update(schema.forumTopics).set({ deletedAt: now }).where(eq(schema.forumTopics.id, target.topicId));
      }
      return { isOpeningPost: true, removedTopic: removesTopic };
    });

    /*
      Images are erased for real, so purgeableImagePosts decides whose may go —
      not whichever posts the delete happened to cover. Removing the opening
      post takes the topic down, but a member still only loses their own
      attachments, and anything with an open report waits for staff. A
      moderator's removal erases everything it covers. When the discussion
      stays up, only the opening post itself was covered.
    */
    const covered = removedTopic
      ? await db
          .select({
            id: schema.forumPosts.id,
            authorId: schema.forumPosts.userId,
            hasOpenReport: sql<boolean>`exists (
              select 1 from ${schema.forumReports} r
              where r.post_id = ${schema.forumPosts.id} and r.status = 'open'
            )`,
          })
          .from(schema.forumPosts)
          .where(eq(schema.forumPosts.topicId, target.topicId))
      : [{ id: postId, authorId: target.authorId, hasOpenReport: await hasOpenReport(db, postId) }];
    await removeForumPostImages(purgeableImagePosts(covered, me.actor));

    // Staff removing someone else's post is moderation and is logged, as the
    // suggestion-reply delete is. An author removing their own stays quiet.
    if (me.userId !== target.authorId) {
      const session = await getSession();
      await recordAudit({
        action: removedTopic ? "forums.topic.remove" : "forums.post.remove",
        actorId: me.userId,
        by: session?.username ?? me.username,
        targetType: "forum_post",
        targetId: postId,
        metadata: { topicId: target.topicId, authorId: target.authorId, moderated: true },
      });
    }

    revalidatePath(`/forums/topic/${target.topicId}`);
    revalidatePath("/forums");
    if (isOpeningPost) revalidatePath(`/forums/${target.forumSlug}`);
    if (removedTopic) {
      return { ok: true, message: "Topic removed.", topicRemoved: true, forumSlug: target.forumSlug };
    }
    if (isOpeningPost) return { ok: true, message: "Your post was removed. The replies stay up." };
    return { ok: true, message: "Post removed." };
  } catch {
    return { ok: false, message: "That post could not be removed." };
  }
}

/**
 * Report a post to staff. Reporting the opening post is how a topic is reported.
 *
 * The post and its author come from the database, never the form. A repeat
 * report while the first is still open is caught by the partial unique index
 * from migration 046 and treated as the success the member already achieved.
 */
export async function reportForumPostAction(input: {
  postId: string;
  reason: string;
  note?: string;
}): Promise<ForumActionResult> {
  const me = await currentActor();
  if (!me) return { ok: false, message: "You must be signed in to report a post." };
  if (!idSchema.safeParse(input?.postId).success) return { ok: false, message: "That post no longer exists." };
  if (!REPORT_REASONS.includes(input.reason as ReportReason)) {
    return { ok: false, message: "Choose a reason for the report." };
  }
  const note = String(input.note ?? "").trim();
  if (note.length > REPORT_NOTE_MAX) {
    return { ok: false, message: `Your note must be ${REPORT_NOTE_MAX} characters or fewer.` };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [post] = await db
    .select({
      id: schema.forumPosts.id,
      authorId: schema.forumPosts.userId,
      deletedAt: schema.forumPosts.deletedAt,
      topicDeletedAt: schema.forumTopics.deletedAt,
    })
    .from(schema.forumPosts)
    .innerJoin(schema.forumTopics, eq(schema.forumTopics.id, schema.forumPosts.topicId))
    .where(eq(schema.forumPosts.id, input.postId))
    .limit(1);
  if (!post || post.topicDeletedAt) return { ok: false, message: "That post no longer exists." };

  const subject = { authorId: post.authorId, deletedAt: post.deletedAt ? new Date(post.deletedAt).toISOString() : null };
  if (!canReportPost(subject, me.actor)) {
    return {
      ok: false,
      message: subject.deletedAt ? "That post was already removed." : "You cannot report this post.",
    };
  }

  const limit = await rateLimitShared(await actionClientKey("forum-report", me.userId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "You're reporting too fast. Wait a moment and try again." };

  try {
    // Untargeted on purpose: the only unique indexes on this table are the two
    // partial "one open report per reporter" indexes from 046, and a post
    // report can only ever trip the post one.
    const inserted = await db
      .insert(schema.forumReports)
      .values({ postId: post.id, reporterId: me.userId, reason: input.reason, note: note || null })
      .onConflictDoNothing()
      .returning({ id: schema.forumReports.id });
    if (!inserted.length) return { ok: true, message: "You have already reported this post." };
  } catch (error) {
    console.error("Failed to file forum report", error);
    return { ok: false, message: "Your report could not be sent. Please try again." };
  }

  revalidatePath("/admin/forums");
  revalidatePath("/admin/forums/reports");
  return { ok: true, message: "Thanks — staff will review this post." };
}

/**
 * Vote on a forum post, including a topic's opening post. `value` 0 removes
 * the member's vote. Locked forums and topics still accept votes — locking
 * stops new writing, not reactions — but a removed topic does not.
 */
export async function voteOnForumPostAction(input: {
  postId: string;
  value: number;
}): Promise<ForumActionResult & { up?: number; down?: number; mine?: VoteValue }> {
  const me = await currentActor();
  if (!me) return { ok: false, message: "Sign in to vote." };
  if (!idSchema.safeParse(input?.postId).success || !isVoteValue(input.value)) {
    return { ok: false, message: "That vote could not be saved." };
  }
  const value = input.value;

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [post] = await db
    .select({
      id: schema.forumPosts.id,
      authorId: schema.forumPosts.userId,
      deletedAt: schema.forumPosts.deletedAt,
      topicDeletedAt: schema.forumTopics.deletedAt,
    })
    .from(schema.forumPosts)
    .innerJoin(schema.forumTopics, eq(schema.forumTopics.id, schema.forumPosts.topicId))
    .where(eq(schema.forumPosts.id, input.postId))
    .limit(1);
  if (!post || post.topicDeletedAt) return { ok: false, message: "That post no longer exists." };

  const subject = { authorId: post.authorId, deletedAt: post.deletedAt ? new Date(post.deletedAt).toISOString() : null };
  if (!canVoteOnComment(subject, { userId: me.userId, accountStatus: me.actor.accountStatus })) {
    return { ok: false, message: post.authorId === me.userId ? "You can't vote on your own post." : "You can't vote on this post." };
  }

  const limit = await rateLimitShared(await actionClientKey("comment-vote", me.userId), {
    limit: COMMENT_VOTES_PER_MINUTE,
    windowMs: 60_000,
  });
  if (!limit.ok) return { ok: false, message: "You're voting too fast. Wait a moment." };

  const v = schema.forumPostVotes;
  try {
    if (value === 0) {
      await db.delete(v).where(and(eq(v.postId, post.id), eq(v.userId, me.userId)));
    } else {
      await db
        .insert(schema.forumPostVotes)
        .values({ postId: post.id, userId: me.userId, value })
        .onConflictDoUpdate({ target: [v.postId, v.userId], set: { value, updatedAt: new Date() } });
    }
    const [totals] = await db
      .select({
        up: sql<number>`(count(*) filter (where ${v.value} = 1))::int`,
        down: sql<number>`(count(*) filter (where ${v.value} = -1))::int`,
      })
      .from(v)
      .where(eq(v.postId, post.id));
    return { ok: true, message: "Vote saved.", up: totals?.up ?? 0, down: totals?.down ?? 0, mine: value };
  } catch (error) {
    console.error("Failed to save forum vote", error);
    return { ok: false, message: "That vote could not be saved." };
  }
}
