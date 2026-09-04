import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowUpDown, History, Receipt, Send, Shield, TriangleAlert } from "lucide-react";
import type { BotActivityEntry } from "@/lib/data/bot-console";
import { relative } from "@/lib/utils";

type ActivityResult = { ok: true; entries: BotActivityEntry[] } | { ok: false; reason: string };

const KIND_META: Record<
  BotActivityEntry["kind"],
  { icon: ComponentType<{ size?: number; className?: string }>; tint: string }
> = {
  order: { icon: Receipt, tint: "border-sky-400/25 bg-sky-500/10 text-sky-500" },
  notice: { icon: Send, tint: "border-accent/25 bg-accent/10 text-accent-bright" },
  role: { icon: Shield, tint: "border-violet-400/25 bg-violet-500/10 text-violet-500" },
  rank: { icon: ArrowUpDown, tint: "border-emerald-400/25 bg-emerald-500/10 text-emerald-500" },
};

const FAILED_TINT = "border-rose-400/30 bg-rose-500/10 text-rose-500";

export function BotActivityPanel({
  activity,
  canViewAuditLog,
}: {
  activity: ActivityResult;
  /**
   * Whether this viewer can actually open /admin/audit-logs.
   *
   * Bot-console access and audit access are separate permissions: audit is
   * IT-tier, the bot console is not. Rendering the link for someone the audit
   * page will bounce is an invitation to a redirect, so it is hidden rather
   * than shown-and-refused.
   */
  canViewAuditLog: boolean;
}) {
  const entries = activity.ok ? activity.entries : [];
  const failures = entries.filter((entry) => !entry.ok).length;

  return (
    <section className="panel overflow-hidden p-0">
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-card/70 text-muted">
            <History size={17} aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-bold">Recent bot activity</h2>
              {failures > 0 && (
                <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-500">
                  {failures} failed
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-muted">What the bot has done on the server lately.</p>
          </div>
        </div>

        {canViewAuditLog && (
          <Link href="/admin/audit-logs" className="btn btn-ghost btn-sm shrink-0 self-start sm:self-auto">
            Full audit log
          </Link>
        )}
      </header>

      {!activity.ok && <p className="px-5 py-5 text-sm text-muted sm:px-6">{activity.reason}</p>}
      {activity.ok && entries.length === 0 && (
        <p className="px-5 py-5 text-sm text-muted sm:px-6">No bot activity recorded yet.</p>
      )}

      {entries.length > 0 && (
        <ul className="divide-y divide-line">
          {entries.map((entry) => {
            const meta = KIND_META[entry.kind];
            const Icon = entry.ok ? meta.icon : TriangleAlert;

            return (
              <li
                key={entry.id}
                className={`flex items-start gap-3 px-5 py-3 sm:px-6 ${entry.ok ? "" : "bg-rose-500/[0.04]"}`}
              >
                {/*
                  A refused role grant used to look identical to a successful
                  one — the difference was a single word inside an otherwise
                  identical grey line. Failure now changes the icon, its colour
                  and the row's ground, so it reads before the text does.
                */}
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                    entry.ok ? meta.tint : FAILED_TINT
                  }`}
                >
                  <Icon size={13} aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                    <span className={`font-semibold ${entry.ok ? "text-ink" : "text-rose-500"}`}>{entry.label}</span>
                    {entry.detail && <span className="min-w-0 break-words text-muted">{entry.detail}</span>}
                  </p>
                  {entry.actor && <p className="mt-0.5 text-[11px] text-muted">by {entry.actor}</p>}
                </div>

                <time className="shrink-0 pt-0.5 text-[11px] text-muted" dateTime={entry.at}>
                  {relative(entry.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
