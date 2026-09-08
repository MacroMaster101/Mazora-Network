import { CheckCircle2, CircleAlert, CircleHelp, Clock3, DatabaseBackup, ExternalLink, Loader } from "lucide-react";
import { formatBackupAge, formatBackupSize, type BackupStatus } from "@/lib/data/backup-status";

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
 *
 * `canOpenRun` narrows the GitHub link to IT. Access to the ops repository is
 * granted per person, not per role in this application, and today only IT holds
 * it — so for an owner the link is a 404 dressed up as an answer. The figures
 * are the part that transfers, and those stay visible to both.
 */

/*
  Every colour is given for both themes. A chip like `text-emerald-200` is
  legible on the dark admin and almost invisible on the light one, and this card
  is read at a glance — a status nobody can read is the same as no status. The
  tint carries the meaning; the text weight carries the legibility.
*/
const PRESENTATION = {
  healthy: {
    Icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-300",
    label: "Healthy",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-200",
    well: "border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-400/20",
  },
  running: {
    Icon: Loader,
    tone: "text-violet-600 dark:text-violet-300",
    label: "Running",
    chip: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:text-violet-200",
    well: "border-violet-500/30 bg-violet-500/10 dark:border-violet-400/20",
  },
  late: {
    Icon: Clock3,
    tone: "text-amber-700 dark:text-amber-300",
    label: "Overdue",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:text-amber-200",
    well: "border-amber-500/30 bg-amber-500/10 dark:border-amber-400/20",
  },
  failed: {
    Icon: CircleAlert,
    tone: "text-rose-600 dark:text-rose-300",
    label: "Failed",
    chip: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:text-rose-200",
    well: "border-rose-500/30 bg-rose-500/10 dark:border-rose-400/20",
  },
  never: {
    Icon: CircleHelp,
    tone: "text-amber-700 dark:text-amber-300",
    label: "Never run",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:text-amber-200",
    well: "border-amber-500/30 bg-amber-500/10 dark:border-amber-400/20",
  },
  unconfigured: {
    Icon: CircleHelp,
    tone: "text-muted",
    label: "Not configured",
    chip: "border-line-strong bg-card/60 text-muted",
    well: "border-line bg-card/60",
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

/*
  Two states tell the reader to go and open the run. Without access to the ops
  repository that is an instruction they cannot carry out, so it becomes "tell
  the person who can" — the same urgency, aimed somewhere it can land.
*/
const DELEGATED: Partial<Record<BackupStatus["health"], string>> = {
  failed: "The last backup run did not succeed. Ask IT to open the run and see which step failed.",
  never: "The workflow exists but has never run. Ask IT to trigger it once and confirm the credentials work.",
};

export function BackupStatusCard({
  status,
  canOpenRun,
}: {
  status: BackupStatus;
  canOpenRun: boolean;
}) {
  const { Icon, label, tone, chip, well } = PRESENTATION[status.health];
  const spinning = status.health === "running";
  const explanation = (!canOpenRun && DELEGATED[status.health]) || EXPLANATION[status.health];
  const size = formatBackupSize(status.run?.storedMb ?? null);

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
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${well} ${tone}`}>
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

          <p className="text-[13px] leading-relaxed text-muted">{explanation}</p>

          {/*
            The row and table counts are the only evidence the dump contained
            anything. A run that connects, reads nothing and uploads an empty
            file still exits 0 and still shows a green tick, so "success" alone
            is not proof of a backup.
          */}
          {(status.run?.rows != null || size) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              {status.run?.rows != null && (
                <span>
                  <strong className="text-ink">{status.run.rows.toLocaleString()}</strong> rows across{" "}
                  <strong className="text-ink">{status.run.tables ?? "?"}</strong> tables
                </span>
              )}
              {status.run?.rows != null && size && <span aria-hidden="true">&middot;</span>}
              {size && (
                <span>
                  {/*
                    "confirmed in R2" is claimed only when the run actually read
                    the bucket back. Otherwise this is what left Supabase, which
                    is not yet a backup, and saying so would be a small lie in
                    the one place a person looks to trust the thing.
                  */}
                  <strong className="text-ink">{size}</strong>
                  {status.run?.storageObjects != null && (
                    <> across {status.run.storageObjects.toLocaleString()} files</>
                  )}
                  {status.run?.storedInR2 && <> confirmed in R2</>}
                </span>
              )}
            </p>
          )}

          {status.error && (
            <p className="text-[13px] text-warning">
              Could not reach GitHub to check: {status.error}
            </p>
          )}

          {canOpenRun && status.run?.url && (
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
