import type { ReactNode } from "react";
import type { FlatComment } from "@/lib/comments/tree";
import type { VoteValue } from "@/lib/comments/vote-rules";
import type { PresenceShown } from "@/lib/presence-rules";
import type { Role } from "@/lib/types";

/**
 * One comment as the shared components render it. Built on the server.
 *
 * Every permission is decided server-side and arrives as a boolean. `body` and
 * `images` are already rendered; `editBody` carries raw text only for a viewer
 * who may edit — these props are serialized into the page payload, so a
 * removed comment's text must never ride along.
 */
export interface CommentView extends FlatComment {
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string | null;
  authorRole: Role;
  /** Wrote the topic or suggestion this comment is under. */
  isOp: boolean;
  /** The author's website status, or null when they are offline, invisible or the comment is removed. */
  authorStatus: Exclude<PresenceShown, "offline"> | null;
  editedAt: string | null;
  myVote: VoteValue;
  body: ReactNode;
  editBody: string | null;
  images: ReactNode;
  canVote: boolean;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
}

export interface VoteResult {
  ok: boolean;
  message: string;
  up?: number;
  down?: number;
  mine?: VoteValue;
}

/** What differs between forums and suggestions, supplied by each feature's client section. */
export interface CommentAdapter {
  bodyMax: number;
  vote(id: string, value: VoteValue): Promise<VoteResult>;
  edit(id: string, body: string): Promise<{ ok: boolean; message: string }>;
  remove(id: string): Promise<{ ok: boolean; message: string; redirectTo?: string }>;
  renderReply(comment: CommentView, onDone: () => void): ReactNode;
  renderReport(comment: CommentView): ReactNode;
}
