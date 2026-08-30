"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Reply as ReplyIcon, Trash2, X } from "lucide-react";
import { UserAvatar } from "@/components/shared";
import { Textarea, useToast } from "@/components/ui";
import { deleteSuggestionReplyAction, editSuggestionReplyAction } from "@/lib/actions/suggestions";
import {
  canDeleteReply,
  canEditReply,
  canPostReply,
  replyBody,
  type ReplyActor,
  type ThreadState,
} from "@/lib/suggestions-rules";
import type { ThreadReply } from "@/lib/data/suggestions-board";
import type { Role } from "@/lib/types";
import { fmtDate, relative } from "@/lib/utils";
import { ReplyComposer } from "./reply-composer";
import { ReportButton } from "./report-button";
import { ImageGallery } from "./image-gallery";

/**
 * One reply row, in position, whether it is live or soft-deleted.
 *
 * The body always goes through `replyBody()` — never `reply.body` directly —
 * so a removed reply renders the tombstone in place rather than disappearing
 * or leaking its original text. `canEdit`/`canDelete`/the Reply control are
 * derived here from `threadState`/`actor` via the same `suggestions-rules.ts`
 * predicates the server actions enforce (`canEditReply`, `canDeleteReply`,
 * `canPostReply`) — this component only decides what to *show*, never what to
 * *allow*, and deriving them per-reply (rather than accepting pre-computed
 * booleans) is what lets a single ReplyItem correctly gate both itself and
 * each of its children, whose `authorId` differs from its own.
 *
 * `viewer`/`loginHref` are passed through untouched to ReportButton, which
 * calls `canReport` itself — this component does not re-derive that
 * permission from `viewer` and `reply.authorId`.
 *
 * `showChildren` gates the one level of nesting: this component renders
 * `reply.children` below the body in a single left-indented block, but each
 * child ReplyItem is mounted with `showChildren={false}` so it never renders
 * a children block of its own — replies never nest past one level, enforced
 * here by simply not recursing rather than by reading `reply.children.length`
 * (which is always empty on a child anyway, since the server caps depth at
 * one). A child still gets its own Reply control: the action re-points a
 * reply-to-a-child back to the top-level ancestor, so replying from a child
 * is always safe.
 */
export function ReplyItem({
  reply,
  threadState,
  actor,
  suggestionId,
  viewer,
  loginHref,
  showChildren = true,
}: {
  reply: ThreadReply;
  threadState: ThreadState;
  actor: ReplyActor;
  suggestionId: string;
  viewer: { userId: string | null; role: Role | null };
  loginHref: string;
  showChildren?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  const [replying, setReplying] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const removed = Boolean(reply.deletedAt);
  const displayName = reply.author.displayName || reply.author.username;
  const replySubject = { authorId: reply.authorId, deletedAt: reply.deletedAt };
  const canEdit = canEditReply(threadState, replySubject, actor);
  const canDelete = canDeleteReply(threadState, replySubject, actor);
  const canReply = canPostReply(threadState, actor) && !removed;

  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await editSuggestionReplyAction({ replyId: reply.id, body: trimmed });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!confirm("Remove this reply? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteSuggestionReplyAction({ replyId: reply.id });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <li className="flex gap-3 border-t border-line py-4 first:border-t-0 first:pt-0">
      <UserAvatar username={reply.author.username} avatarUrl={reply.author.avatarUrl} size={38} rounded="rounded-xl" className="ring-2 ring-line" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{displayName}</span>
          <span className="text-xs text-muted">@{reply.author.username} · <time dateTime={reply.createdAt} title={fmtDate(reply.createdAt)}>{relative(reply.createdAt)}</time></span>
          {reply.editedAt && !removed && <span className="text-xs italic text-muted">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={4000} />
            <div className="flex gap-2">
              <button type="button" onClick={saveEdit} disabled={pending || !draft.trim()} className="btn btn-primary btn-sm">
                {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(reply.body);
                }}
                disabled={pending}
                className="btn btn-ghost btn-sm"
              >
                <X size={14} aria-hidden="true" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className={removed ? "mt-1.5 text-sm italic text-muted" : "mt-1.5 whitespace-pre-line text-sm leading-relaxed"}>
            {replyBody(reply)}
          </p>
        )}

        {!editing && <ImageGallery images={reply.images} canRemove={canDelete} />}

        {!editing && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent-bright"
              >
                <Pencil size={12} aria-hidden="true" /> Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger"
              >
                <Trash2 size={12} aria-hidden="true" /> Delete
              </button>
            )}
            {canReply && (
              <button
                type="button"
                onClick={() => setReplying((open) => !open)}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent-bright"
              >
                <ReplyIcon size={12} aria-hidden="true" /> {replying ? "Cancel" : "Reply"}
              </button>
            )}
            <ReportButton
              target={{ kind: "reply", id: reply.id, authorId: reply.authorId, deletedAt: reply.deletedAt }}
              viewer={viewer}
              loginHref={loginHref}
            />
          </div>
        )}

        {replying && (
          <div className="mt-3">
            <ReplyComposer suggestionId={suggestionId} parentId={reply.id} onSuccess={() => setReplying(false)} />
          </div>
        )}

        {showChildren && reply.children.length > 0 && (
          <ul className="mt-4 space-y-0 border-l border-line pl-4">
            {reply.children.map((child) => (
              <ReplyItem
                key={child.id}
                reply={child}
                threadState={threadState}
                actor={actor}
                suggestionId={suggestionId}
                viewer={viewer}
                loginHref={loginHref}
                showChildren={false}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
