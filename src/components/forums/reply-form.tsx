"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Reply, X } from "lucide-react";
import { createPostAction } from "@/lib/actions/forums";
import { ImagePicker } from "@/components/suggestions/image-picker";
import { PostComposer } from "./post-composer";

/**
 * The reply composer. At the foot of the topic it posts a top-level reply;
 * given `replyTo` it answers that post and nests under it. The server decides
 * where the reply actually attaches, so a forged `replyTo` gains nothing.
 */
export function ReplyForm({
  topicId,
  replyTo,
  onDone,
}: {
  topicId: string;
  replyTo?: { id: string; author: string };
  onDone?: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [composerKey, setComposerKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className={replyTo ? "w-full space-y-3 rounded-2xl border border-line bg-ink/[0.02] p-4" : "panel space-y-3 p-5"}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          // A rejected request body (oversized images) throws instead of
          // returning a result; the member's text must survive that too.
          const result = await createPostAction(formData).catch(() => ({
            ok: false as const,
            message: "That could not be posted. If you attached images, try smaller ones.",
          }));
          setNotice(result.message);
          // Clear only on success — a rejection must leave the text where it was.
          if (result.ok) {
            form.reset();
            setComposerKey((key) => key + 1);
            onDone?.();
            // The server owns the thread; refresh rather than guessing locally.
            router.refresh();
          }
        });
      }}
    >
      {replyTo ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Replying to <span className="text-accent-bright">{replyTo.author}</span>
          </p>
          <button type="button" aria-label="Cancel reply" className="btn btn-ghost btn-sm" onClick={onDone}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <h2 className="font-display text-base font-bold">Post a reply</h2>
      )}
      <input type="hidden" name="topicId" value={topicId} />
      {replyTo && <input type="hidden" name="replyTo" value={replyTo.id} />}
      <PostComposer
        key={composerKey}
        placeholder={replyTo ? `Reply to ${replyTo.author}…` : "Share your thoughts…"}
        rows={replyTo ? 3 : 5}
      />
      <ImagePicker />
      {notice && <p className="text-sm font-semibold text-muted">{notice}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
        {replyTo ? <Reply size={15} /> : <MessageSquarePlus size={15} />} {pending ? "Posting…" : "Post reply"}
      </button>
    </form>
  );
}
