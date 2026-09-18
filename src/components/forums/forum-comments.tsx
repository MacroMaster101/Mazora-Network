"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { CommentItem } from "@/components/comments/comment-item";
import { CommentThread } from "@/components/comments/comment-thread";
import type { CommentAdapter, CommentView } from "@/components/comments/types";
import { deletePostAction, editPostAction, voteOnForumPostAction } from "@/lib/actions/forums";
import { BODY_MAX } from "@/lib/forums-rules";
import type { CommentNode, CommentSort } from "@/lib/comments/tree";
import { ReplyForm } from "./reply-form";
import { ReportPostButton } from "./report-post-button";

/**
 * A forum topic's opening post and comments, on the shared comment components.
 * This file only adapts forum actions to the shared shape.
 */
export function ForumComments({
  topicId,
  basePath,
  loginHref,
  sort,
  opening,
  nodes,
  totalComments,
  focusBackHref,
}: {
  topicId: string;
  basePath: string;
  loginHref: string | null;
  sort: CommentSort;
  opening: CommentView | null;
  nodes: CommentNode<CommentView>[];
  totalComments: number;
  focusBackHref: string | null;
}) {
  const adapter = useMemo<CommentAdapter>(
    () => ({
      bodyMax: BODY_MAX,
      vote: (id, value) => voteOnForumPostAction({ postId: id, value }),
      edit: (id, body) => {
        const formData = new FormData();
        formData.set("postId", id);
        formData.set("body", body);
        return editPostAction(formData);
      },
      remove: async (id) => {
        const result = await deletePostAction(id);
        return { ...result, redirectTo: result.topicRemoved && result.forumSlug ? `/forums/${result.forumSlug}` : undefined };
      },
      renderReply: (comment, onDone): ReactNode => (
        <ReplyForm topicId={topicId} replyTo={{ id: comment.id, author: comment.authorName }} onDone={onDone} />
      ),
      renderReport: (comment): ReactNode => <ReportPostButton postId={comment.id} isOpeningPost={comment.id === opening?.id} />,
    }),
    [topicId, opening?.id],
  );

  return (
    <div className="space-y-5">
      {opening && (
        <ul className="panel p-4 sm:p-5">
          <CommentItem
            node={{ comment: opening, depth: 0, children: [], descendantCount: 0 }}
            basePath={basePath}
            loginHref={loginHref}
            adapter={adapter}
            sort={sort}
          />
        </ul>
      )}
      <div className="panel p-4 sm:p-5">
        <CommentThread
          nodes={nodes}
          totalComments={totalComments}
          sort={sort}
          basePath={basePath}
          loginHref={loginHref}
          adapter={adapter}
          focusBackHref={focusBackHref}
          emptyText="No comments yet. Start the conversation below."
        />
      </div>
    </div>
  );
}
