"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerDownRight, MessageSquare, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { RankChip } from "@/components/admin/rank-chip";
import { PresenceDot } from "@/components/presence/presence-dot";
import { UserAvatar } from "@/components/shared";
import { useToast } from "@/components/ui";
import { commentHref, MAX_VISIBLE_DEPTH, type CommentNode, type CommentSort } from "@/lib/comments/tree";
import { cn, fmtDate, relative } from "@/lib/utils";
import { CommentMenu } from "./comment-menu";
import { ShareButton } from "./share-button";
import type { CommentAdapter, CommentView } from "./types";
import { VoteControl } from "./vote-control";

/**
 * One comment and, recursively, its replies.
 *
 * Collapse is client-only. The thread line down the left of the replies is
 * itself a collapse button, as on Reddit. At MAX_VISIBLE_DEPTH a comment with
 * replies links to a focused view instead of indenting further.
 */
export function CommentItem({
  node,
  basePath,
  loginHref,
  adapter,
  sort,
}: {
  node: CommentNode<CommentView>;
  basePath: string;
  loginHref: string | null;
  adapter: CommentAdapter;
  sort: CommentSort;
}) {
  const { comment, depth, children, descendantCount } = node;
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.editBody ?? "");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const removed = Boolean(comment.deletedAt);
  const anchor = `comment-${comment.id}`;

  function saveEdit() {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await adapter.edit(comment.id, body);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm("Remove this comment?")) return;
    startTransition(async () => {
      const result = await adapter.remove(comment.id);
      toast(result.message, result.ok ? "success" : "error");
      if (!result.ok) return;
      if (result.redirectTo) router.push(result.redirectTo);
      else router.refresh();
    });
  }

  const menuItems = [
    comment.canEdit && {
      key: "edit",
      node: (
        <button type="button" onClick={() => { setDraft(comment.editBody ?? ""); setEditing(true); }}>
          <Pencil size={14} aria-hidden="true" /> Edit
        </button>
      ),
    },
    comment.canDelete && {
      key: "remove",
      node: (
        <button type="button" onClick={remove} className="text-danger">
          <Trash2 size={14} aria-hidden="true" /> Remove
        </button>
      ),
    },
    comment.canReport && { key: "report", node: adapter.renderReport(comment) },
  ].filter((item): item is { key: string; node: ReactNode } => Boolean(item));

  if (collapsed) {
    return (
      <li id={anchor} className="flex items-center gap-2 py-2">
        <button type="button" aria-label="Expand comment" aria-expanded={false} onClick={() => setCollapsed(false)} className="comment-action px-1.5">
          <Plus size={14} aria-hidden="true" />
        </button>
        <span className="text-xs text-muted">
          <strong className="font-semibold text-ink">{removed ? "Removed comment" : comment.authorName}</strong> ·{" "}
          {relative(comment.createdAt)}
          {descendantCount > 0 && ` · ${descendantCount} ${descendantCount === 1 ? "reply" : "replies"}`}
        </span>
      </li>
    );
  }

  return (
    <li id={anchor} className="scroll-mt-28 rounded-xl py-2 target:bg-accent/10 target:ring-1 target:ring-accent/40">
      <div className="flex gap-2.5">
        <div className="flex flex-col items-center">
          {removed ? (
            <div className="h-8 w-8 shrink-0 rounded-full bg-ink/[0.06]" aria-hidden="true" />
          ) : (
            <span className="relative shrink-0">
              <UserAvatar username={comment.authorUsername} avatarUrl={comment.authorAvatar ?? undefined} size={32} rounded="rounded-full" />
              {/* Only when they are around: an absent dot reads as offline, which is also what Invisible looks like. */}
              {comment.authorStatus && (
                <PresenceDot
                  status={comment.authorStatus}
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 border-[rgb(var(--card))]"
                />
              )}
            </span>
          )}
          {children.length > 0 && (
            <button
              type="button"
              aria-label="Collapse thread"
              onClick={() => setCollapsed(true)}
              className="group mt-1 flex w-4 flex-1 justify-center"
            >
              <span className="w-0.5 rounded-full bg-line transition group-hover:bg-accent" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {removed ? (
              <span className="font-semibold text-muted">[removed]</span>
            ) : (
              <>
                <strong className="text-sm font-bold text-ink">{comment.authorName}</strong>
                {comment.authorRole !== "member" && comment.authorRole !== "guest" && <RankChip role={comment.authorRole} />}
                {comment.isOp && (
                  <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent-bright">OP</span>
                )}
              </>
            )}
            <span className="text-muted">·</span>
            <time className="text-muted" dateTime={comment.createdAt} title={fmtDate(comment.createdAt)}>
              {relative(comment.createdAt)}
            </time>
            {comment.editedAt && !removed && <span className="italic text-muted">edited</span>}
            <button type="button" aria-label="Collapse comment" onClick={() => setCollapsed(true)} className="comment-action ml-auto px-1.5 sm:ml-0">
              <Minus size={14} aria-hidden="true" />
            </button>
          </header>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={adapter.bodyMax}
                rows={4}
                className="input w-full resize-y"
              />
              <div className="flex gap-2">
                <button type="button" onClick={saveEdit} disabled={pending || !draft.trim()} className="btn btn-primary btn-sm">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} disabled={pending} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={cn("mt-1 space-y-2 text-sm leading-relaxed", removed && "italic text-muted")}>{comment.body}</div>
          )}

          {!editing && !removed && comment.images}

          {!editing && (
            <div className="mt-1 flex flex-wrap items-center gap-0.5">
              <VoteControl
                commentId={comment.id}
                up={comment.up}
                down={comment.down}
                mine={comment.myVote}
                canVote={comment.canVote}
                loginHref={removed ? null : loginHref}
                vote={adapter.vote}
              />
              {comment.canReply && (
                <button type="button" onClick={() => setReplying((open) => !open)} className="comment-action">
                  <MessageSquare size={14} aria-hidden="true" /> Reply
                </button>
              )}
              {!removed && <ShareButton href={`${commentHref(basePath, sort, { comment: comment.id })}#${anchor}`} />}
              <CommentMenu items={menuItems} />
            </div>
          )}

          {replying && <div className="mt-2">{adapter.renderReply(comment, () => setReplying(false))}</div>}

          {depth >= MAX_VISIBLE_DEPTH
            ? descendantCount > 0 && (
                <Link
                  href={commentHref(basePath, sort, { focus: comment.id })}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-accent-bright hover:underline"
                >
                  <CornerDownRight size={14} aria-hidden="true" /> Continue this thread ({descendantCount})
                </Link>
              )
            : children.length > 0 && (
                <ul className="mt-1 -ml-1 pl-1 sm:pl-2">
                  {children.map((child) => (
                    <CommentItem key={child.comment.id} node={child} basePath={basePath} loginHref={loginHref} adapter={adapter} sort={sort} />
                  ))}
                </ul>
              )}
        </div>
      </div>
    </li>
  );
}
