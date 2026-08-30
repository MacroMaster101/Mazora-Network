"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, Flag, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui";
import { reportContentAction } from "@/lib/actions/reports";
import { canReport, REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/lib/report-rules";
import type { Role } from "@/lib/types";

const NOTE_LIMIT = 1000;

export interface ReportButtonTarget {
  kind: "suggestion" | "reply";
  id: string;
  authorId: string;
  deletedAt: string | null;
}

export interface ReportButtonViewer {
  userId: string | null;
  role: Role | null;
}

/**
 * Low-emphasis "Report" affordance for a suggestion or a reply. A safety
 * valve, not a primary action — it must never compete visually with Vote or
 * Reply, so it renders as a small muted text link, not a button.
 *
 * `canReport` (report-rules.ts) is the single source of truth for whether
 * this renders at all, and this component never re-implements its logic.
 * It only branches on *why* `canReport` returned false, in the same order
 * `canReport` itself checks: signed-out (`viewer.userId === null`) gets a
 * login link, everything else (own content, already-removed content) gets
 * nothing — offering someone a report control they cannot use is confusing,
 * and offering it on their own words doubly so.
 *
 * `reportContentAction` (Task 4) only revalidates the admin queue path, not
 * this page, so a successful submit is reflected by holding a `reported`
 * flag in client state — never by `router.refresh()`, which would not even
 * pick up the change here.
 */
export function ReportButton({
  target,
  viewer,
  loginHref,
}: {
  target: ReportButtonTarget;
  viewer: ReportButtonViewer;
  loginHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();
  const titleId = useId();
  const noteId = `${titleId}-note`;
  const radioName = `${titleId}-reason`;

  useEffect(() => setMounted(true), []);

  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (reported) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 dark:text-muted/70">
        <Check size={11} aria-hidden="true" /> Reported
      </span>
    );
  }

  const allowed = canReport(
    { authorId: target.authorId, deletedAt: target.deletedAt },
    { userId: viewer.userId, role: viewer.role },
  );

  if (!allowed) {
    // Same precedence canReport itself uses: signed-out is checked first, so
    // it wins even if the content also happens to be removed.
    if (viewer.userId === null) {
      return (
        <Link
          href={loginHref}
          title="Log in to report"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 dark:text-muted dark:hover:text-ink/80"
        >
          <Flag size={11} aria-hidden="true" /> Report
        </Link>
      );
    }
    return null;
  }

  function closeDialog() {
    setOpen(false);
    setError(null);
  }

  function submit() {
    setError(null);
    const payload =
      target.kind === "suggestion"
        ? { suggestionId: target.id, reason, note: note.trim() || undefined }
        : { replyId: target.id, reason, note: note.trim() || undefined };

    startTransition(async () => {
      const result = await reportContentAction(payload);
      if (result.ok) {
        // Covers both a fresh report and the "already reported" duplicate
        // case — both come back as ok: true, and both land here.
        setReported(true);
        setOpen(false);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 dark:text-muted dark:hover:text-ink/80"
      >
        <Flag size={11} aria-hidden="true" /> Report
      </button>

      {mounted &&
        open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={closeDialog}
          >
            <div className="flex min-h-full items-center justify-center">
              <div className="my-auto w-full max-w-md animate-fade-up" onClick={(event) => event.stopPropagation()}>
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-line-strong dark:bg-card">
                  <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:max-h-[calc(100dvh-3rem)] sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <h2
                        id={titleId}
                        className="font-display text-lg font-extrabold leading-tight text-gray-900 dark:text-ink"
                      >
                        Report this {target.kind === "suggestion" ? "suggestion" : "reply"}
                      </h2>
                      <button
                        type="button"
                        onClick={closeDialog}
                        aria-label="Close"
                        className="shrink-0 rounded-lg p-1 text-gray-500 transition-colors hover:text-gray-900 dark:text-muted dark:hover:text-ink"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <fieldset className="mt-4">
                      <legend className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-muted">
                        Reason
                      </legend>
                      <div className="mt-2 space-y-1.5">
                        {REPORT_REASONS.map((value) => (
                          <label
                            key={value}
                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-ink/80"
                          >
                            <input
                              type="radio"
                              name={radioName}
                              value={value}
                              checked={reason === value}
                              onChange={() => setReason(value)}
                              className="h-4 w-4 shrink-0 accent-accent"
                            />
                            {REPORT_REASON_LABELS[value]}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <label htmlFor={noteId} className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-muted">
                          Note (optional)
                        </label>
                        <span className="text-[11px] font-semibold text-gray-400 dark:text-muted/70">
                          {note.length}/{NOTE_LIMIT}
                        </span>
                      </div>
                      <Textarea
                        id={noteId}
                        value={note}
                        onChange={(event) => setNote(event.target.value.slice(0, NOTE_LIMIT))}
                        rows={3}
                        maxLength={NOTE_LIMIT}
                        placeholder="Add any extra context (optional)"
                        className="mt-1.5"
                      />
                    </div>

                    {error && (
                      <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
                        {error}
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-200 pt-4 dark:border-line/50">
                      <button
                        type="button"
                        onClick={closeDialog}
                        disabled={pending}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-line dark:bg-surface dark:text-ink/80 dark:hover:bg-surface/80"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submit}
                        disabled={pending}
                        className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                      >
                        {pending ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Flag size={13} aria-hidden="true" />
                        )}
                        Submit report
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
