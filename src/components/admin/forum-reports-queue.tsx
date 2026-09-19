"use client";

import { useState, useTransition } from "react";
import Link from "@/components/ui/app-link";
import { AlertTriangle, ExternalLink, Flag, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui";
import { DashEmpty } from "@/components/dashboard/dash-ui";
import type { ForumReportItem } from "@/lib/data/forum-reports";
import { dismissForumReportAction, removeReportedPostAction } from "@/lib/actions/forums-admin";
import { FORUM_REPORT_REASON_LABELS } from "@/lib/forums-rules";
import { commentHref } from "@/lib/comments/tree";
import type { ReportReason } from "@/lib/report-rules";
import { fmtDate } from "@/lib/utils";

/**
 * Staff review of reported forum posts. Reports on the same post are shown as
 * one card, since the decision — remove or dismiss — is about the post, and
 * both actions close every open report on it.
 */
export function ForumReportsQueue({ initialReports }: { initialReports: ForumReportItem[] }) {
  const [reports, setReports] = useState(initialReports);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const byPost = new Map<string, ForumReportItem[]>();
  for (const report of reports) byPost.set(report.post.id, [...(byPost.get(report.post.id) ?? []), report]);

  function act(postReports: ForumReportItem[], kind: "remove" | "dismiss") {
    const [first] = postReports;
    if (
      kind === "remove" &&
      !window.confirm(
        first.post.isOpeningPost
          ? "Remove this post? It is the opening post, so the whole topic is removed."
          : "Remove this post?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = kind === "remove" ? await removeReportedPostAction(first.id) : await dismissForumReportAction(first.id);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) setReports((current) => current.filter((report) => report.post.id !== first.post.id));
    });
  }

  if (byPost.size === 0) {
    return (
      <DashEmpty
        icon={<Flag size={22} />}
        title="No open reports"
        message="Nothing is waiting for review. Posts members report will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {[...byPost.values()].map((postReports) => {
        const [first] = postReports;
        const { post, topic, forum } = first;
        return (
          <article key={post.id} className="panel space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md border border-line bg-ink/5 px-2.5 py-0.5 font-semibold text-muted">
                  {forum.name}
                </span>
                <span className="rounded-md border border-line bg-ink/5 px-2.5 py-0.5 font-semibold text-muted">
                  {post.isOpeningPost ? "Topic" : "Reply"}
                </span>
                {postReports.length > 1 && (
                  <span className="flex items-center gap-1 rounded-md border border-red-500/25 bg-red-500/10 px-2 py-0.5 font-bold text-red-700 dark:text-red-400">
                    <AlertTriangle size={11} aria-hidden="true" /> {postReports.length} reports
                  </span>
                )}
              </div>
              <Link
                href={`${commentHref(`/forums/topic/${topic.id}`, "best", { comment: post.id })}#comment-${post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-accent-bright hover:underline"
              >
                View in topic <ExternalLink size={12} aria-hidden="true" />
              </Link>
            </div>

            <div className="space-y-2 rounded-xl border border-line bg-ink/5 p-3">
              <p className="text-xs text-muted">
                In <strong className="font-semibold text-ink">{topic.title}</strong> · by{" "}
                <strong className="font-semibold text-ink">{post.author}</strong> · {fmtDate(post.createdAt)}
              </p>
              {/* Plain text on purpose: staff see exactly what was written, markup included. */}
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{post.body}</p>
              {post.images.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {post.images.map((image) => (
                    <li key={image.id}>
                      <a href={image.url} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt="Attached image" className="h-20 w-20 rounded-lg border border-line object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {post.removed && <p className="text-xs font-semibold text-muted">Already removed from the forum.</p>}
            </div>

            <ul className="space-y-1.5">
              {postReports.map((report) => (
                <li key={report.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                    {FORUM_REPORT_REASON_LABELS[report.reason as ReportReason] ?? report.reason}
                  </span>
                  <span>
                    <strong className="font-semibold text-ink">{report.reporter}</strong> · {fmtDate(report.createdAt)}
                    {report.note && <> — “{report.note}”</>}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => act(postReports, "remove")}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-500/20 dark:text-red-400"
              >
                <Trash2 size={14} aria-hidden="true" /> {post.removed ? "Resolve" : "Remove post"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(postReports, "dismiss")}
                className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-ink/5 hover:text-ink"
              >
                <X size={14} aria-hidden="true" /> Dismiss
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
