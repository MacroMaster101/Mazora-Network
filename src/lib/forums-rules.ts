import type { ReportReason } from "@/lib/report-rules";
import type { Role } from "@/lib/types";

/** Shown in place of a removed post so a topic keeps its shape. */
export const POST_TOMBSTONE = "This post was removed.";

export const TOPICS_PER_PAGE = 25;
export const POSTS_PER_PAGE = 20;

export interface ForumActor {
  userId: string | null;
  role: Role | null;
  /** `profiles.account_status`. A suspended account keeps its session. */
  accountStatus: string | null;
  /** Resolved from FORUMS_PERMISSION_KEY by the caller. */
  canModerate: boolean;
}

export interface ForumState { locked: boolean }
export interface TopicState { locked: boolean; deletedAt: string | null }
export interface PostSubject { authorId: string; deletedAt: string | null }

/** A session alone is not enough: a suspended account must not be able to post. */
function canWrite(actor: ForumActor): boolean {
  return actor.userId !== null && actor.accountStatus === "active";
}

export function canCreateTopic(forum: ForumState, actor: ForumActor): boolean {
  return canWrite(actor) && !forum.locked;
}

export function canReply(forum: ForumState, topic: TopicState, actor: ForumActor): boolean {
  return canWrite(actor) && !forum.locked && !topic.locked && topic.deletedAt === null;
}

/** Moderators remove posts; they never rewrite someone else's words. */
export function canEditPost(
  forum: ForumState,
  topic: TopicState,
  post: PostSubject,
  actor: ForumActor,
): boolean {
  if (post.deletedAt) return false;
  // A removed topic is out of every write path, exactly as canReply treats it.
  if (topic.deletedAt) return false;
  if (forum.locked || topic.locked) return false;
  return canWrite(actor) && actor.userId === post.authorId;
}

export function canDeletePost(post: PostSubject, actor: ForumActor): boolean {
  if (post.deletedAt) return false;
  // A suspended account must not be able to delete posts just because it still
  // resolves to a moderator role — canWrite gates every write path, this one included.
  if (canWrite(actor) && actor.canModerate) return true;
  return canWrite(actor) && actor.userId === post.authorId;
}

/** Shown as the topic's author once they have deleted their opening post. */
export const DELETED_AUTHOR = "[deleted]";

/**
 * Whether removing a topic's opening post removes the whole topic.
 *
 * An author deleting their own opening post takes back their words, not
 * everyone else's: once other members have replied, the discussion stays up
 * with the opening post shown as removed. With nobody else in it there is
 * nothing to keep. A moderator removing someone's opening post is moderating
 * the topic, so the topic goes.
 */
export function openingDeleteRemovesTopic(input: { actorIsAuthor: boolean; othersReplied: boolean }): boolean {
  return !input.actorIsAuthor || !input.othersReplied;
}

export function postBody(post: PostSubject & { body: string }): string {
  return post.deletedAt ? POST_TOMBSTONE : post.body;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= 60 && SLUG_PATTERN.test(value);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const TITLE_MIN = 3;
export const TITLE_MAX = 140;
export const BODY_MIN = 1;
export const BODY_MAX = 8000;

/** Bounds are checked on the trimmed value — whitespace is not content. */
export function isValidTitle(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= TITLE_MIN && trimmed.length <= TITLE_MAX;
}

export function isValidBody(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= BODY_MIN && trimmed.length <= BODY_MAX;
}

/**
 * Retitling is the topic's equivalent of editing a post, so it follows the same
 * rule: only the author, never a moderator. A moderator who dislikes a title
 * removes the topic rather than rewriting what someone said.
 */
export function canEditTopicTitle(
  forum: ForumState,
  topic: TopicState,
  actor: ForumActor,
  topicAuthorId: string,
): boolean {
  if (topic.deletedAt) return false;
  if (forum.locked || topic.locked) return false;
  return canWrite(actor) && actor.userId === topicAuthorId;
}

/**
 * The order a list should have after moving one item up or down.
 *
 * Returns a new array; never mutates. Moving past either end returns the list
 * unchanged. Callers renumber from the result by array position, which is why
 * rows sharing a sort_order — the default, so the common case — still move to
 * exactly the right place instead of leapfrogging the whole list.
 */
export function moveInOrder<T>(items: readonly T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Forum wording for the shared report reasons (report-rules.ts), which suggestions phrase for suggestions. */
export const FORUM_REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  abuse: "Abuse or harassment",
  off_topic: "Off topic",
  duplicate: "Duplicate post",
  other: "Something else",
};

export const REPORT_NOTE_MAX = 1000;

/**
 * Whether `actor` may report a post: an active member, not its author, and
 * the post still live. "Already reported" is not checked here — the partial
 * unique index from migration 046 enforces it, which a pure rule cannot.
 */
export function canReportPost(post: PostSubject, actor: ForumActor): boolean {
  return canWrite(actor) && post.deletedAt === null && post.authorId !== actor.userId;
}

export interface PostImagesSubject {
  id: string;
  authorId: string;
  /** A report staff have not closed yet. */
  hasOpenReport: boolean;
}

/**
 * Whose attachments a delete may actually erase from storage.
 *
 * Removing a post is a soft delete, but its images are erased for real. Two
 * rules keep that from reaching further than the person's own words:
 *
 *  - a member only ever erases their own attachments, even when deleting the
 *    opening post takes the whole topic down with it — other members' files
 *    stay, already hidden behind the removed topic;
 *  - an attachment with an open report stays until staff have seen it, so an
 *    author cannot delete the evidence out from under a report.
 *
 * A moderator erases everything the delete covers: that is the point of a
 * moderation removal, and the report queue is theirs to close.
 */
export function purgeableImagePosts(posts: readonly PostImagesSubject[], actor: ForumActor): string[] {
  if (actor.canModerate) return posts.map((post) => post.id);
  return posts.filter((post) => post.authorId === actor.userId && !post.hasOpenReport).map((post) => post.id);
}
