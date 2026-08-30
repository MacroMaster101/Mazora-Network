"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Textarea, useToast } from "@/components/ui";
import { postSuggestionReplyAction } from "@/lib/actions/suggestions";
import { ImagePicker } from "./image-picker";

/**
 * Posts a new reply to a suggestion thread.
 *
 * Only rendered by ThreadView when the caller is signed in and the thread is
 * unlocked (both booleans it already has) — `postSuggestionReplyAction` is
 * the real enforcement, this is presentation only.
 *
 * `parentId` is optional: when present this composer targets a reply-to-reply
 * (the server re-points and caps depth at one), when absent it behaves
 * exactly as a top-level reply, unchanged from before nesting existed.
 * `onSuccess` is an optional extra callback (in addition to the toast and
 * `router.refresh()`, both of which always run) — ReplyItem uses it to close
 * its inline composer once the reply has actually posted.
 */
export function ReplyComposer({
  suggestionId,
  parentId,
  onSuccess,
}: {
  suggestionId: string;
  parentId?: string;
  onSuccess?: () => void;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const bodyId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const trimmed = body.trim();
    if (!trimmed) return;

    const formData = new FormData(form);
    formData.set("suggestionId", suggestionId);
    formData.set("body", trimmed);
    if (parentId) formData.set("parentId", parentId);

    startTransition(async () => {
      try {
        const result = await postSuggestionReplyAction(formData);
        toast(result.message, result.ok ? "success" : "error");
        if (result.ok) {
          setBody("");
          form.reset();
          router.refresh();
          onSuccess?.();
        }
      } catch (error) {
        // A body rejected by the transport (e.g. too large) or a network
        // failure rejects this promise rather than resolving to { ok: false }.
        // Without this catch that throws to the nearest error boundary and
        // the member loses their typed reply. Leave `body` (and the form)
        // untouched so nothing is lost.
        console.error("Failed to submit suggestion reply", error);
        toast("Your reply could not be sent. If you attached images, try smaller ones.", "error");
      }
    });
  }

  return (
    <form onSubmit={submit} className="glass space-y-3 p-5">
      <label htmlFor={bodyId} className="text-sm font-semibold">
        Add a reply
      </label>
      <Textarea
        id={bodyId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxLength={4000}
        required
        placeholder="Share your thoughts on this suggestion…"
      />
      <ImagePicker />
      <div className="flex items-center justify-end">
        <button type="submit" disabled={pending || !body.trim()} className="btn btn-primary btn-sm disabled:opacity-60">
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          {pending ? "Posting…" : "Post reply"}
        </button>
      </div>
    </form>
  );
}
