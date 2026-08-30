import Link from "next/link";
import { Lock, MessageCircle } from "lucide-react";
import type { SuggestionThread } from "@/lib/data/suggestions-board";
import { canDeleteReply, type ReplyActor, type ThreadState } from "@/lib/suggestions-rules";
import type { Role } from "@/lib/types";
import { UserAvatar } from "@/components/shared";
import { fmtDate, relative } from "@/lib/utils";
import { CategoryChip, StatusPill } from "./suggestion-meta";
import { VoteButton } from "./vote-button";
import { ReplyItem } from "./reply-item";
import { ReplyComposer } from "./reply-composer";
import { ReportButton } from "./report-button";
import { ImageGallery } from "./image-gallery";

/**
 * Full thread surface: the suggestion, its vote button, the reply list (in
 * position, tombstones included), and — depending on viewer state — the
 * composer, a locked notice, or a login prompt.
 *
 * `canEdit`/`canDelete` per reply are computed here from the same
 * `suggestions-rules.ts` predicates Task 5's server actions enforce, so the
 * buttons ReplyItem shows always agree with what the action would actually
 * allow. This is presentation only: the actions re-check everything against
 * the database on every call.
 */
export function ThreadView({
  thread,
  viewerId,
  viewerRole,
  isLoggedIn,
  canModerate,
  loginHref,
}: {
  thread: SuggestionThread;
  viewerId: string | null;
  viewerRole: Role | null;
  isLoggedIn: boolean;
  canModerate: boolean;
  loginHref: string;
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
              <MessageCircle size={13} aria-hidden="true" /> {thread.repliesCount} {thread.repliesCount === 1 ? "reply" : "replies"}
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

          {thread.replies.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No replies yet. Be the first to share your thoughts.</p>
          ) : (
            <ul className="mt-2">
              {thread.replies.map((reply) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  threadState={threadState}
                  actor={actor}
                  suggestionId={thread.id}
                  viewer={viewer}
                  loginHref={loginHref}
                />
              ))}
            </ul>
          )}

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
        </section>
      </div>
    </div>
  );
}
