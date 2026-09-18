"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, MessageSquarePlus, MessagesSquare, Send } from "lucide-react";
import { createTopicAction } from "@/lib/actions/forums";
import { TITLE_MAX } from "@/lib/forums-rules";
import { Modal } from "@/components/ui";
import { ImagePicker } from "@/components/suggestions/image-picker";
import { CreateForumButton, type CategoryChoice } from "./forum-dialogs";
import { DialogHeader, Notice } from "./dialog-parts";
import { PostComposer } from "./post-composer";

export interface ForumChoice {
  id: string;
  name: string;
  category: string;
}

/**
 * The way into the conversation from the board: start a discussion in any open
 * forum, in a dialog.
 *
 * The bar sits on a solid `panel` rather than bare over the page: the board is
 * drawn over the world backdrop, and a ghost button there had no surface of its
 * own and washed out in both themes.
 *
 * Staff holding the Community Forums permission also get "Create a forum".
 *
 * `canPost` and `canCreateForums` are decided on the server and only choose
 * what renders. Both actions re-check everything themselves, so nothing here
 * is a gate.
 */
export function CommunityActions({
  canPost,
  forums,
  categories,
  canCreateForums,
}: {
  canPost: boolean;
  forums: ForumChoice[];
  categories: CategoryChoice[];
  canCreateForums: boolean;
}) {
  if (!canPost) {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">Sign in to start a discussion or reply to one.</p>
        <Link href="/login?next=/forums" className="btn btn-primary btn-sm">
          <LogIn size={15} /> Sign in to join
        </Link>
      </div>
    );
  }

  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-display text-base font-bold">Join the conversation</p>
        <p className="text-sm text-muted">Pick a forum and start a discussion, or jump into one below.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StartDiscussionButton forums={forums} />
        {canCreateForums && <CreateForumButton categories={categories} />}
      </div>
    </div>
  );
}

/**
 * The "Start a discussion" button and its dialog. Given one forum — as on a
 * forum's own page — the dialog posts there without asking where.
 */
export function StartDiscussionButton({ forums, label = "Start a discussion" }: { forums: ForumChoice[]; label?: string }) {
  const [open, setOpen] = useState(false);
  // Remounts the dialog body on every open so a closed draft never reappears half-sent.
  const [version, setVersion] = useState(0);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={forums.length === 0}
        onClick={() => {
          setVersion((value) => value + 1);
          setOpen(true);
        }}
      >
        <MessageSquarePlus size={15} /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label="Start a discussion">
        <StartDiscussion key={version} forums={forums} />
      </Modal>
    </>
  );
}

function StartDiscussion({ forums }: { forums: ForumChoice[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fixed = forums.length === 1 ? forums[0] : null;

  return (
    <section className="bg-card text-ink">
      <DialogHeader
        icon={<MessagesSquare size={21} aria-hidden="true" />}
        eyebrow="Community discussion"
        title="Start a discussion"
        lead={fixed ? `Posting in ${fixed.name}. Give it a clear title and say what's on your mind.` : "Pick a forum, give it a clear title and say what's on your mind."}
      />
      <form
        className="space-y-5 px-6 py-6 sm:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            // A rejected request body (e.g. oversized images) throws rather than
            // returning; catching it keeps the member's writing on screen.
            try {
              const result = await createTopicAction(formData);
              if (result.ok && result.topicId) router.push(`/forums/topic/${result.topicId}`);
              else setError(result.message);
            } catch {
              setError("Your discussion could not be posted. If you attached images, try smaller ones.");
            }
          });
        }}
      >
        {fixed ? (
          <input type="hidden" name="forumId" value={fixed.id} />
        ) : (
          <label className="block space-y-2 text-sm">
            <span className="font-semibold">Forum</span>
            <select name="forumId" required className="input w-full" defaultValue="">
              <option value="" disabled>Choose where to post…</option>
              {forums.map((forum) => (
                <option key={forum.id} value={forum.id}>
                  {forum.category} — {forum.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-2 text-sm">
          <span className="font-semibold">Title</span>
          <input name="title" required minLength={3} maxLength={TITLE_MAX} placeholder="Discussion title" className="input w-full" />
        </label>
        <div className="space-y-2 text-sm">
          <span className="font-semibold">Message</span>
          <PostComposer placeholder="What would you like to talk about?" rows={7} />
        </div>
        <div>
          <p className="text-sm font-semibold">Attach images (optional)</p>
          <div className="mt-2">
            <ImagePicker />
          </div>
        </div>
        <Notice message={error} />
        <div className="flex justify-end border-t border-line pt-5">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {pending ? "Posting…" : "Post discussion"}
          </button>
        </div>
      </form>
    </section>
  );
}
