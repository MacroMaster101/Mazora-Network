/**
 * Voting on comments, shared by forum posts and suggestion replies.
 *
 * Pure so it can be tested and used by both the server actions (the real
 * gate) and the client (to decide what to render and to update optimistically).
 */

export type VoteValue = -1 | 0 | 1;

/** Per member, across every comment. A vote is cheap, so this only stops scripted flooding. */
export const COMMENT_VOTES_PER_MINUTE = 30;

export function isVoteValue(value: unknown): value is VoteValue {
  return value === -1 || value === 0 || value === 1;
}

/**
 * An active member may vote on someone else's live comment. Voting on your
 * own words is refused rather than auto-applied — a score should say what
 * other people think. A suspended account keeps its session, so the account
 * status is checked, not just the session.
 */
export function canVoteOnComment(
  comment: { authorId: string; deletedAt: string | null },
  voter: { userId: string | null; accountStatus: string | null },
): boolean {
  if (!voter.userId || voter.accountStatus !== "active") return false;
  if (comment.deletedAt) return false;
  return comment.authorId !== voter.userId;
}

/** Clicking the arrow you already chose removes your vote; the other arrow switches it. */
export function nextVote(current: VoteValue, clicked: 1 | -1): VoteValue {
  return current === clicked ? 0 : clicked;
}

/** The totals after one member's vote moves from `from` to `to`, for the optimistic UI. */
export function scoreAfter(up: number, down: number, from: VoteValue, to: VoteValue): { up: number; down: number } {
  return {
    up: up - (from === 1 ? 1 : 0) + (to === 1 ? 1 : 0),
    down: down - (from === -1 ? 1 : 0) + (to === -1 ? 1 : 0),
  };
}
