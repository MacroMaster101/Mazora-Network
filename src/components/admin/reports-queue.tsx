"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ExternalLink, Flag, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui";
import { MinecraftAvatar } from "@/components/shared";
import { fmtDate, cn } from "@/lib/utils";
import { DashEmpty } from "@/components/dashboard/dash-ui";
import type { ReportQueueItem } from "@/lib/data/reports";
import { resolveReportAction, dismissReportAction } from "@/lib/actions/reports";
import { deleteSuggestionReplyAction } from "@/lib/actions/suggestions";
import { deleteSuggestionAction } from "@/lib/actions/suggestions-admin";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/report-rules";
import { REPLY_TOMBSTONE } from "@/lib/suggestions-rules";
import { ImageGallery } from "@/components/suggestions/image-gallery";

function sameTarget(a: ReportQueueItem, b: ReportQueueItem): boolean {
  return a.target.kind === b.target.kind && a.target.id === b.target.id;
}

function reasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason as ReportReason] || reason;
}

/**
 * Staff moderation queue for community reports. Mirrors the optimistic
 * update + rollback pattern from suggestions-manager.tsx: apply the change to
 * local state immediately, fire the server action, and only roll back if it
 * comes back !ok.
 *
 * "Remove content" calls the existing delete path for the target's kind —
 * never a new one:
 *  - suggestion -> deleteSuggestionAction (hard delete; the DB cascades
 *    content_reports rows for that suggestion, so every report on it is
 *    filtered out of local state, not just this one).
 *  - reply -> deleteSuggestionReplyAction (soft delete; the report row stays
 *    open so staff can still Resolve/Dismiss it, but the content now renders
 *    as the tombstone instead of the live body).
 */
export function ReportsQueue({ initialReports }: { initialReports: ReportQueueItem[] }) {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportQueueItem[]>(initialReports);
  const [isPending, startTransition] = useTransition();

  function handleRemoveContent(report: ReportQueueItem) {
    const label = report.target.kind === "suggestion" ? "suggestion" : "reply";
    if (!confirm(`Remove this ${label}? This cannot be undone.`)) return;

    const previous = reports;

    if (report.target.kind === "suggestion") {
      // Deleting a suggestion is a hard delete that cascades in the DB to its
      // replies and every content_report against the suggestion OR any of those
      // replies. Mirror that: drop every queued report sharing this thread id,
      // not just the ones whose target is the suggestion itself — otherwise
      // reports on the deleted thread's replies linger as phantoms until reload.
      setReports((prev) => prev.filter((r) => r.target.suggestionId !== report.target.suggestionId));
    } else {
      const now = new Date().toISOString();
      setReports((prev) =>
        prev.map((r) =>
          r.target.kind === "reply" && r.target.id === report.target.id
            ? { ...r, target: { ...r.target, deletedAt: now } }
            : r,
        ),
      );
    }

    startTransition(async () => {
      const res =
        report.target.kind === "suggestion"
          ? await deleteSuggestionAction(
              (() => {
                const fd = new FormData();
                fd.set("id", report.target.id);
                fd.set("title", report.target.title);
                return fd;
              })(),
            )
          : await deleteSuggestionReplyAction({ replyId: report.target.id });

      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) setReports(previous);
    });
  }

  function handleSetStatus(report: ReportQueueItem, status: "resolved" | "dismissed", allForTarget: boolean) {
    const previous = reports;
    setReports((prev) =>
      allForTarget ? prev.filter((r) => !sameTarget(r, report)) : prev.filter((r) => r.id !== report.id),
    );

    startTransition(async () => {
      const action = status === "resolved" ? resolveReportAction : dismissReportAction;
      const res = await action({ reportId: report.id, allForTarget });
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) setReports(previous);
    });
  }

  if (reports.length === 0) {
    return (
      <DashEmpty
        icon={<Flag size={22} />}
        title="No open reports"
        message="The moderation queue is clear. Member reports against suggestions and replies will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const removed = Boolean(report.target.deletedAt);
        const reporterName = report.reporter.displayName || report.reporter.username;
        const authorName = report.target.author.displayName || report.target.author.username;

        return (
          <article key={report.id} className="panel panel-hover p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
                  {reasonLabel(report.reason)}
                </span>
                <span className="text-xs font-semibold text-muted bg-ink/5 px-2.5 py-0.5 rounded-md border border-line capitalize">
                  {report.target.kind}
                </span>
                {report.reportCount > 1 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                    <AlertTriangle size={11} /> {report.reportCount} reports on this item
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted">{fmtDate(report.createdAt)}</span>
            </div>

            <div className="rounded-xl border border-line bg-ink/5 p-3 space-y-1.5">
              {report.target.kind === "reply" ? (
                <p className="text-[11px] text-muted">
                  Reply on <strong className="text-ink font-semibold">{report.target.title}</strong>
                </p>
              ) : (
                <h4 className="font-display text-sm font-bold text-ink">{report.target.title}</h4>
              )}
              <p
                className={cn(
                  "text-xs leading-relaxed whitespace-pre-line",
                  removed ? "italic text-muted" : "text-ink/90",
                )}
              >
                {removed ? REPLY_TOMBSTONE : report.target.body}
              </p>
              {/* The attachments on the reported item. Without these a moderator
                  triaging an image report sees only text and has to leave the
                  queue for the public thread to judge it. Removal stays on the
                  thread's own gallery; this is for looking, not acting. */}
              {!removed && report.target.images.length > 0 && (
                <ImageGallery images={report.target.images} />
              )}
              <div className="flex items-center gap-2 pt-1">
                <MinecraftAvatar username={report.target.author.username} size={18} />
                <span className="text-[11px] text-muted">
                  by <strong className="text-ink font-semibold">{authorName}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <MinecraftAvatar username={report.reporter.username} size={18} />
                <span>
                  Reported by <strong className="text-ink font-semibold">{reporterName}</strong>
                  {report.note ? <> — “{report.note}”</> : null}
                </span>
                <Link
                  href={`/support/suggestions/${report.target.suggestionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent-bright hover:underline"
                >
                  View thread <ExternalLink size={11} />
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!removed && (
                  <button
                    type="button"
                    onClick={() => handleRemoveContent(report)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition"
                  >
                    <Trash2 size={14} /> Remove content
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSetStatus(report, "resolved", false)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
                >
                  <Check size={14} /> Resolve
                </button>
                {report.reportCount > 1 && (
                  <button
                    type="button"
                    onClick={() => handleSetStatus(report, "resolved", true)}
                    disabled={isPending}
                    title="Resolve and clear all reports on this item"
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/10 transition"
                  >
                    Resolve all ({report.reportCount})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSetStatus(report, "dismissed", false)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-line text-muted hover:text-ink hover:bg-ink/5 transition"
                >
                  <X size={14} /> Dismiss
                </button>
                {report.reportCount > 1 && (
                  <button
                    type="button"
                    onClick={() => handleSetStatus(report, "dismissed", true)}
                    disabled={isPending}
                    title="Dismiss and clear all reports on this item"
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-muted hover:bg-ink/5 transition"
                  >
                    Dismiss all ({report.reportCount})
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
