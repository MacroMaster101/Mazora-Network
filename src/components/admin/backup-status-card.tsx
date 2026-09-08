import { CheckCircle2, CircleAlert, CircleHelp, Clock3, DatabaseBackup, ExternalLink, Loader } from "lucide-react";
import { formatBackupAge, type BackupStatus } from "@/lib/data/backup-status";

/**
 * Off-site backup health, shown on the settings page below the feature toggles.
 *
 * Backups run on a schedule in a separate private repository and land in
 * Cloudflare R2. Nothing about them is visible from this application otherwise,
 * which is the problem: the way scheduled backups fail is by quietly stopping —
 * GitHub disables a workflow after 60 days of repository inactivity, a token
 * expires, someone deletes the schedule — and none of those produce a failure
 * anywhere a person would see. This makes the silence visible.
 *
 * Read-only by design. There is no trigger button, because triggering needs a
 * token that can *write* to that repository, and the card's whole value is
 * being able to see the state without this application holding any credential
 * that could change it.
 *
 * Server component: the GitHub token is read during render and never reaches
 * the browser.
 */

const PRESENTATION = {
  healthy: {
    Icon: CheckCircle2,
    label: "Healthy",
    tone: "text-success",
    chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  running: {
    Icon: Loader,
    label: "Running",
    tone: "text-accent-bright",
    chip: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  },
  late: {
    Icon: Clock3,
    label: "Overdue",
    tone: "text-warning",
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  failed: {
    Icon: CircleAlert,
    label: "Failed",
    tone: "text-danger",
    chip: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  },
  never: {
    Icon: CircleHelp,
    label: "Never run",
    tone: "text-warning",
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  unconfigured: {
    Icon: CircleHelp,
    label: "Not configured",
    tone: "text-muted",
    chip: "border-line-strong bg-card/60 text-muted",
  },
} as const;

/*
  Each line says what to do, not merely what happened. "Overdue" on its own
  leaves the reader to work out whether that is theirs to fix; naming the
  likeliest cause — GitHub's 60-day rule — turns the card into an instruction.
*/
const EXPLANATION: Record<BackupStatus["health"], string> = {
  healthy: "The last scheduled backup completed and uploaded to Cloudflare R2.",
  running: "A backup is in progress. This card will settle once it finishes.",
  late: "No successful backup recently. GitHub disables scheduled workflows after 60 days of repository inactivity — check the Actions tab is still enabled.",
  failed: "The last backup run did not succeed. Open the run to see which step failed.",
  never: "The workflow exists but has never run. Trigger it once by hand to confirm the credentials work.",
  unconfigured: "Set GITHUB_BACKUP_TOKEN and GITHUB_BACKUP_REPO to show backup health here.",
};

export function BackupStatusCard({ status }: { status: BackupStatus }) {
  const { Icon, label, tone, chip } = PRESENTATION[status.health];
  const spinning = status.health === "running";

  return (
    <section className="panel p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <DatabaseBackup size={18} className="text-accent-bright" />
        <h2 className="font-display text-base font-bold text-ink">Off-site Backups</h2>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-muted">
          Owner &amp; IT only
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card/60 ${tone}`}>
          <Icon size={20} className={spinning ? "animate-spin" : undefined} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${chip}`}
            >
              {label}
            </span>
            {status.health !== "unconfigured" && status.health !== "never" && (
              <span className="text-sm text-muted">
                Last run {formatBackupAge(status.ageMs)}
              </span>
            )}
          </p>

          <p className="text-[13px] leading-relaxed text-muted">{EXPLANATION[status.health]}</p>

          {/*
            The row and table counts are the only evidence the dump contained
            anything. A run that connects, reads nothing and uploads an empty
            file still exits 0 and still shows a green tick, so "success" alone
            is not proof of a backup.
          */}
          {status.run?.rows != null && (
            <p className="text-[13px] text-muted">
              <strong className="text-ink">{status.run.rows.toLocaleString()}</strong> rows across{" "}
              <strong className="text-ink">{status.run.tables ?? "?"}</strong> tables
            </p>
          )}

          {status.error && (
            <p className="text-[13px] text-warning">
              Could not reach GitHub to check: {status.error}
            </p>
          )}

          {status.run?.url && (
            <a
              href={status.run.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-bright underline underline-offset-2"
            >
              View the run on GitHub <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
