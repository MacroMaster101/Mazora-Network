import Link from "next/link";
import type { BotActivityEntry } from "@/lib/data/bot-console";
import { relative } from "@/lib/utils";

type ActivityResult = { ok: true; entries: BotActivityEntry[] } | { ok: false; reason: string };

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
  return (
    <section className="panel p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Recent bot activity</h2>
        {canViewAuditLog && (
          <Link href="/admin/audit-logs" className="btn btn-ghost btn-sm">
            Full audit log
          </Link>
        )}
      </header>

      {!activity.ok && <p className="text-sm text-muted">{activity.reason}</p>}
      {activity.ok && activity.entries.length === 0 && (
        <p className="text-sm text-muted">No bot activity recorded yet.</p>
      )}

      {activity.ok && activity.entries.length > 0 && (
        <ul className="grid gap-2">
          {activity.entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {entry.label}
                {entry.detail && <span className="text-muted"> · {entry.detail}</span>}
                {entry.actor && <span className="text-xs text-muted"> by {entry.actor}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">{relative(entry.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
