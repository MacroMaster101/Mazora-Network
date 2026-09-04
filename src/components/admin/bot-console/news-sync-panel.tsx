import { CalendarClock, Newspaper, Rss } from "lucide-react";
import type { NewsSyncReport } from "@/lib/data/bot-console";
import { fmtDate } from "@/lib/utils";

type NewsResult = { ok: true; report: NewsSyncReport } | { ok: false; reason: string };

export function NewsSyncPanel({ news }: { news: NewsResult }) {
  return (
    <section className="panel overflow-hidden p-0">
      <header className="flex gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-500">
          <Rss size={17} aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-sm font-bold">News sync</h2>
          <p className="mt-0.5 text-[11px] text-muted">Announcements pulled from Discord into the newsroom.</p>
        </div>
      </header>

      {!news.ok && <p className="px-5 py-5 text-sm text-muted sm:px-6">{news.reason}</p>}

      {news.ok && (
        <div className="grid gap-4 px-5 py-5 sm:px-6">
          <dl className="grid gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <dt className="text-sm text-muted">Source channel</dt>
              <dd>
                <span
                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                    news.report.channelConfigured
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-500"
                      : "border-amber-400/25 bg-amber-500/10 text-amber-500"
                  }`}
                >
                  {news.report.channelConfigured ? "Configured" : "Not configured"}
                </span>
              </dd>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <dt className="flex items-center gap-1.5 text-sm text-muted">
                <CalendarClock size={13} aria-hidden /> Schedule
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg border border-line bg-card/70 px-2 py-1 font-mono text-[11px] leading-none">
                  {news.report.cronSchedule}
                </code>
                <span className="text-[11px] text-muted">daily, 00:00 UTC</span>
              </dd>
            </div>
          </dl>

          {/*
            The article itself, not the date, is what someone opens this card to
            check — so it leads, and the timestamp becomes its caption. It was
            previously a truncated grey afterthought under the numbers.
          */}
          <div className="rounded-xl border border-line bg-ink/[0.035] p-3.5 dark:bg-black/15">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Last imported article</p>
              {news.report.lastImportedAt && (
                <p className="shrink-0 text-[11px] text-muted">{fmtDate(news.report.lastImportedAt)}</p>
              )}
            </div>

            {news.report.lastImportedTitle ? (
              <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-ink">
                <Newspaper size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 break-words">{news.report.lastImportedTitle}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Nothing imported yet.</p>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-muted">
            This is the newest imported article, not a run log — a sync that imported nothing, or failed, leaves no
            record.
          </p>
        </div>
      )}
    </section>
  );
}
