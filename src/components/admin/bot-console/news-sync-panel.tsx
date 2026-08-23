import type { NewsSyncReport } from "@/lib/data/bot-console";
import { fmtDate } from "@/lib/utils";

type NewsResult = { ok: true; report: NewsSyncReport } | { ok: false; reason: string };

export function NewsSyncPanel({ news }: { news: NewsResult }) {
  return (
    <section className="panel p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">News sync</h2>
      </header>

      {!news.ok && <p className="text-sm text-muted">{news.reason}</p>}

      {news.ok && (
        <>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Source channel</dt>
              <dd className={news.report.channelConfigured ? "text-emerald-400" : "text-amber-400"}>
                {news.report.channelConfigured ? "Configured" : "Not configured"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Schedule</dt>
              <dd className="font-mono text-xs">{news.report.cronSchedule} (daily, 00:00 UTC)</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Last imported article</dt>
              <dd>{news.report.lastImportedAt ? fmtDate(news.report.lastImportedAt) : "none yet"}</dd>
            </div>
          </dl>
          {news.report.lastImportedTitle && (
            <p className="mt-2 truncate text-xs text-muted">{news.report.lastImportedTitle}</p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            This is the newest imported article, not a run log — a sync that imported nothing, or
            failed, leaves no record.
          </p>
        </>
      )}
    </section>
  );
}
