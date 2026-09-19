import Link from "@/components/ui/app-link";
import { Lock, MessageCircle } from "lucide-react";
import type { SuggestionThread, ThreadReply } from "@/lib/data/suggestions-board";
import {
  canDeleteReply,
  canEditReply,
  canPostReply,
  replyBody,
  type ReplyActor,
  type ThreadState,
} from "@/lib/suggestions-rules";
import { canVoteOnComment } from "@/lib/comments/vote-rules";
import { canReport } from "@/lib/report-rules";
import { commentHref, MAX_VISIBLE_DEPTH, type CommentNode, type CommentSort } from "@/lib/comments/tree";
import type { Role } from "@/lib/types";
import type { CommentView } from "@/components/comments/types";
import { UserAvatar } from "@/components/shared";
import { fmtDate, relative } from "@/lib/utils";
import { CategoryChip, StatusPill } from "./suggestion-meta";
import { VoteButton } from "./vote-button";
import { SuggestionComments } from "./suggestion-comments";
import { ReplyComposer } from "./reply-composer";
import { ReportButton } from "./report-button";
import { ImageGallery } from "./image-gallery";

/**
 * Builds the shared comment components' view tree from `ThreadReply` nodes,
 * deciding every permission here (server-side) via the same
 * `suggestions-rules.ts` predicates the shared comment actions enforce, so
 * the buttons SuggestionComments shows always agree with what the action
 * would actually allow. This is presentation only: the actions re-check
 * everything against the database on every call.
 *
 * A removed reply's author is neutralised — permissions above are already
 * computed from the real row, so nothing downstream needs it. Below
 * MAX_VISIBLE_DEPTH, children are not serialised into the page payload at
 * all — the page links to a focused view instead — but `descendantCount`
 * stays real so "Continue this thread (N)" still shows a true count.
 */
function toViewTree(
  nodes: CommentNode<ThreadReply>[],
  thread: SuggestionThread,
  threadState: ThreadState,
  actor: ReplyActor,
  accountStatus: string | null,
): CommentNode<CommentView>[] {
  return nodes.map((node) => {
    const reply = node.comment;
    const subject = { authorId: reply.authorId, deletedAt: reply.deletedAt };
    const canEdit = canEditReply(threadState, subject, actor);
    const canDelete = canDeleteReply(threadState, subject, actor);
    const removed = Boolean(reply.deletedAt);
    const comment: CommentView = {
      id: reply.id,
      parentId: reply.parentId,
      createdAt: reply.createdAt,
      deletedAt: reply.deletedAt,
      up: reply.up,
      down: reply.down,
      authorId: removed ? "" : reply.authorId,
      authorName: removed ? "" : reply.author.displayName || reply.author.username,
      authorUsername: removed ? "removed" : reply.author.username,
      authorAvatar: removed ? null : reply.author.avatarUrl,
      authorRole: removed ? "member" : reply.authorRole,
      isOp: removed ? false : reply.authorId === thread.authorId,
      authorStatus: removed ? null : reply.authorStatus,
      editedAt: reply.editedAt,
      myVote: reply.myVote,
      body: <p className="whitespace-pre-line">{replyBody(reply)}</p>,
      editBody: canEdit ? reply.body : null,
      images: reply.images.length ? <ImageGallery images={reply.images} canRemove={canDelete} /> : null,
      canVote: canVoteOnComment(subject, { userId: actor.userId, accountStatus }),
      canReply: !reply.deletedAt && canPostReply(threadState, actor),
      canEdit,
      canDelete,
      canReport: canReport(subject, { userId: actor.userId, role: actor.role }),
    };
    if (node.depth >= MAX_VISIBLE_DEPTH) return { ...node, comment, children: [] };
    return { ...node, comment, children: toViewTree(node.children, thread, threadState, actor, accountStatus) };
  });
}

/**
 * Full thread surface: the suggestion, its vote button, the reply list (in
 * position, tombstones included), and — depending on viewer state — the
 * composer, a locked notice, or a login prompt.
 *
 * `canEdit`/`canDelete` per reply are computed here from the same
 * `suggestions-rules.ts` predicates the shared comment actions enforce, so
 * the buttons SuggestionComments shows always agree with what the action
 * would actually allow. This is presentation only: the actions re-check
 * everything against the database on every call.
 */
export function ThreadView({
  thread,
  viewerId,
  viewerRole,
  isLoggedIn,
  canModerate,
  loginHref,
  sort,
  accountStatus,
}: {
  thread: SuggestionThread;
  viewerId: string | null;
  viewerRole: Role | null;
  isLoggedIn: boolean;
  canModerate: boolean;
  loginHref: string;
  sort: CommentSort;
  accountStatus: string | null;
}) {
  const actor: ReplyActor = { userId: viewerId, role: viewerRole, canModerate };
  const threadState: ThreadState = { locked: thread.locked };
  const displayName = thread.author.displayName || thread.author.username;
  const viewer = { userId: viewerId, role: viewerRole };
  // Same predicate the reply Delete control uses (owner while unlocked, or a
  // moderator regardless of lock state) — deleteSuggestionImageAction applies
  // that identical rule to a suggestion's own images, so there is no separate
  // permission concept to invent here.
  const canRemoveThreadImages = canDeleteReply(threadState, { authorId: thread.authorId, deletedAt: null }, actor);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {/* Meta card: status/category, vote button, author, reply count. On
       *  mobile it sits above the discussion (order-1); at `lg` it moves into
       *  a sticky right rail beside the reading column (order-2) via CSS
       *  `order` alone, so there is exactly one VoteButton instance — never
       *  two mounted copies of a stateful client component. */}
      <aside className="glass order-1 flex flex-col gap-5 p-6 lg:sticky lg:top-24 lg:order-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={thread.status} />
          <CategoryChip category={thread.category} />
          {thread.locked && (
            <span className="chip gap-1.5 text-warning">
              <Lock size={12} aria-hidden="true" /> Locked
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <VoteButton
            suggestionId={thread.id}
            votesCount={thread.votesCount}
            hasVoted={thread.hasVoted}
            isLoggedIn={isLoggedIn}
            loginHref={loginHref}
          />
          <span className="flex items-center gap-3">
            <span className="chip w-fit gap-1.5">
              <MessageCircle size={13} aria-hidden="true" /> {thread.totalReplies} {thread.totalReplies === 1 ? "reply" : "replies"}
            </span>
            <ReportButton
              target={{ kind: "suggestion", id: thread.id, authorId: thread.authorId, deletedAt: null }}
              viewer={viewer}
              loginHref={loginHref}
            />
          </span>
        </div>

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <UserAvatar username={thread.author.username} avatarUrl={thread.author.avatarUrl} size={44} rounded="rounded-2xl" className="ring-2 ring-line" />
          <div>
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="text-xs text-muted">@{thread.author.username} · <time dateTime={thread.createdAt} title={fmtDate(thread.createdAt)}>{relative(thread.createdAt)}</time></p>
          </div>
        </div>
      </aside>

      <div className="order-2 min-w-0 space-y-6 lg:order-1 lg:max-w-[70ch]">
        <article className="glass p-6 sm:p-8">
          <h1 className="text-balance font-display text-2xl font-black leading-tight sm:text-3xl">{thread.title}</h1>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted sm:text-base">{thread.description}</p>
          <ImageGallery images={thread.images} canRemove={canRemoveThreadImages} />
        </article>

        <section className="glass p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold">Discussion</h2>

          <SuggestionComments
            suggestionId={thread.id}
            basePath={`/support/suggestions/${thread.id}`}
            loginHref={isLoggedIn ? null : loginHref}
            sort={sort}
            nodes={toViewTree(thread.replies, thread, threadState, actor, accountStatus)}
            totalComments={thread.totalReplies}
            focusBackHref={thread.focusId ? commentHref(`/support/suggestions/${thread.id}`, sort, {}) : null}
            viewer={viewer}
            reportLoginHref={loginHref}
          />

          {!thread.focusId && (
            <div className="mt-6 border-t border-line pt-6">
              {thread.locked ? (
                <p className="glass flex items-center gap-2 px-5 py-4 text-sm text-muted">
                  <Lock size={15} aria-hidden="true" /> This thread is locked. New replies are no longer accepted.
                </p>
              ) : isLoggedIn ? (
                <ReplyComposer suggestionId={thread.id} />
              ) : (
                <div className="glass flex flex-col items-center gap-3 px-5 py-8 text-center text-sm text-muted">
                  <span>Log in to join the discussion.</span>
                  <Link href={loginHref} className="btn btn-primary btn-sm">
                    Log in to reply
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
