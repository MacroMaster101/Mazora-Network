"use client";

import { useMemo, type ReactNode } from "react";
import { CommentThread } from "@/components/comments/comment-thread";
import type { CommentAdapter, CommentView } from "@/components/comments/types";
import { deleteSuggestionReplyAction, editSuggestionReplyAction, voteOnSuggestionReplyAction } from "@/lib/actions/suggestions";
import type { CommentNode, CommentSort } from "@/lib/comments/tree";
import type { Role } from "@/lib/types";
import { ReplyComposer } from "./reply-composer";
import { ReportButton } from "./report-button";

/** Matches the SQL CHECK on suggestion_replies.body (migration 038). */
const REPLY_MAX = 4000;

/** A suggestion's replies on the shared comment components. This file only adapts suggestion actions. */
export function SuggestionComments({
  suggestionId,
  basePath,
  loginHref,
  sort,
  nodes,
  totalComments,
  focusBackHref,
  viewer,
  reportLoginHref,
}: {
  suggestionId: string;
  basePath: string;
  loginHref: string | null;
  sort: CommentSort;
  nodes: CommentNode<CommentView>[];
  totalComments: number;
  focusBackHref: string | null;
  viewer: { userId: string | null; role: Role | null };
  reportLoginHref: string;
}) {
  const adapter = useMemo<CommentAdapter>(
    () => ({
      bodyMax: REPLY_MAX,
      vote: (id, value) => voteOnSuggestionReplyAction({ replyId: id, value }),
      edit: (id, body) => editSuggestionReplyAction({ replyId: id, body }),
      remove: (id) => deleteSuggestionReplyAction({ replyId: id }),
      renderReply: (comment, onDone): ReactNode => (
        <ReplyComposer suggestionId={suggestionId} parentId={comment.id} onSuccess={onDone} />
      ),
      renderReport: (comment): ReactNode => (
        <ReportButton
          target={{ kind: "reply", id: comment.id, authorId: comment.authorId, deletedAt: comment.deletedAt }}
          viewer={viewer}
          loginHref={reportLoginHref}
        />
      ),
    }),
    [suggestionId, viewer, reportLoginHref],
  );

  return (
    <CommentThread
      nodes={nodes}
      totalComments={totalComments}
      sort={sort}
      basePath={basePath}
      loginHref={loginHref}
      adapter={adapter}
      focusBackHref={focusBackHref}
      emptyText="No replies yet. Be the first to share your thoughts."
    />
  );
}
