import type { Role } from "@/lib/types";

/** Shown in place of a removed reply so a thread keeps its shape. */
export const REPLY_TOMBSTONE = "This reply was removed.";

export const SUGGESTION_SORTS = ["newest", "top"] as const;
export type SuggestionSort = (typeof SUGGESTION_SORTS)[number];
/** Votes-first would be self-reinforcing and bury every new idea. */
export const DEFAULT_SUGGESTION_SORT: SuggestionSort = "newest";

export interface ReplyActor {
  userId: string | null;
  role: Role | null;
  /** Resolved from SUGGESTIONS_PERMISSION_KEY by the caller. */
  canModerate: boolean;
}
export interface ReplySubject { authorId: string; deletedAt: string | null }
export interface ThreadState { locked: boolean }

export function canVote(actor: ReplyActor): boolean {
  return actor.userId !== null;
}

export function canPostReply(thread: ThreadState, actor: ReplyActor): boolean {
  return actor.userId !== null && !thread.locked;
}

/** Moderators remove replies; they never rewrite someone else's words. */
export function canEditReply(thread: ThreadState, reply: ReplySubject, actor: ReplyActor): boolean {
  if (reply.deletedAt) return false;
  if (thread.locked) return false;
  return actor.userId !== null && actor.userId === reply.authorId;
}

export function canDeleteReply(thread: ThreadState, reply: ReplySubject, actor: ReplyActor): boolean {
  if (reply.deletedAt) return false;
  if (actor.canModerate) return true;
  return actor.userId !== null && actor.userId === reply.authorId && !thread.locked;
}

export function replyBody(reply: ReplySubject & { body: string }): string {
  return reply.deletedAt ? REPLY_TOMBSTONE : reply.body;
}

export interface ParentRef {
  id: string;
  parentId: string | null;
}

/**
 * The parent a new reply should actually attach to, given the reply the member
 * clicked "reply" on. Replying to a top-level reply attaches to it; replying to
 * a child attaches to that child's own parent — the top-level ancestor — so the
 * tree can never exceed one level. `null` means a new top-level reply.
 *
 * This is the single source of the depth-one invariant; the post action calls
 * it rather than branching inline.
 */
export function effectiveParentId(parent: ParentRef | null): string | null {
  if (!parent) return null;
  return parent.parentId ?? parent.id;
}
