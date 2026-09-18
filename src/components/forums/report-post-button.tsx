"use client";

import { useState, useTransition } from "react";
import { Check, Flag, Loader2 } from "lucide-react";
import { reportForumPostAction } from "@/lib/actions/forums";
import { FORUM_REPORT_REASON_LABELS, REPORT_NOTE_MAX } from "@/lib/forums-rules";
import { REPORT_REASONS, type ReportReason } from "@/lib/report-rules";
import { Modal, useToast } from "@/components/ui";
import { DialogHeader, Notice } from "./dialog-parts";

/**
 * A quiet "Report" control under a post, opening a dialog with a reason and an
 * optional note. Whether it renders is decided on the server with
 * canReportPost; the action checks the same rule again.
 */
export function ReportPostButton({ postId, isOpeningPost }: { postId: string; isOpeningPost: boolean }) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [version, setVersion] = useState(0);

  if (reported) {
    return (
      <span className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-muted">
        <Check size={13} aria-hidden="true" /> Reported
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-muted transition hover:text-ink"
        onClick={() => {
          setVersion((value) => value + 1);
          setOpen(true);
        }}
      >
        <Flag size={13} aria-hidden="true" /> Report
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label="Report post" size="compact">
        <ReportForm
          key={version}
          postId={postId}
          isOpeningPost={isOpeningPost}
          onReported={() => {
            setOpen(false);
            setReported(true);
          }}
        />
      </Modal>
    </>
  );
}

function ReportForm({
  postId,
  isOpeningPost,
  onReported,
}: {
  postId: string;
  isOpeningPost: boolean;
  onReported: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <section className="bg-card text-ink">
      <DialogHeader
        icon={<Flag size={21} aria-hidden="true" />}
        eyebrow="Community safety"
        title={isOpeningPost ? "Report this topic" : "Report this post"}
        lead="Staff will review it. The author is not told who reported it."
      />
      <form
        className="space-y-5 px-6 py-6 sm:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await reportForumPostAction({ postId, reason, note });
            if (!result.ok) return setError(result.message);
            toast(result.message, "success");
            onReported();
          });
        }}
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Why are you reporting it?</legend>
          {REPORT_REASONS.map((value) => (
            <label
              key={value}
              className={
                reason === value
                  ? "flex cursor-pointer items-center gap-3 rounded-xl border border-accent bg-accent/10 px-3 py-2.5 text-sm font-semibold"
                  : "flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm text-muted transition hover:border-accent/40 hover:text-ink"
              }
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-[rgb(var(--accent))]"
              />
              {FORUM_REPORT_REASON_LABELS[value]}
            </label>
          ))}
        </fieldset>
        <label className="block space-y-2 text-sm">
          <span className="font-semibold">
            Anything staff should know? <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={REPORT_NOTE_MAX}
            rows={3}
            className="input w-full resize-y"
          />
        </label>
        <Notice message={error} />
        <div className="flex justify-end border-t border-line pt-5">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
            {pending ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </section>
  );
}
