/**
 * How the admin card judges whether off-site backups are actually happening.
 *
 * Free of `server-only` so the rule is unit tested directly; the fetch that
 * feeds it lives in lib/data/backup-status.ts.
 *
 * Backups run on a schedule in a separate private repository (mazora-backups)
 * and land in Cloudflare R2. Nothing in this application performs or receives
 * them — this reads the outcome of the last run so the state is visible where
 * staff already are, instead of only in another repository's Actions tab.
 *
 * The failure this is built around is silence. A disabled schedule, an expired
 * token or a deleted workflow all produce *no run at all*, which is
 * indistinguishable from success if you only check whether the last run passed.
 * So age is treated as a first-class signal: a backup that has not happened is
 * as much a problem as one that failed.
 */

export type BackupHealth =
  /** A successful run inside the stale window. */
  | "healthy"
  /** Ran and failed, or was cancelled or timed out. */
  | "failed"
  /** Currently executing — GitHub reports no conclusion yet. */
  | "running"
  /** Succeeded too long ago, or we cannot tell when it succeeded. */
  | "late"
  /** The workflow exists but has never run. */
  | "never"
  /** No token or repository configured, so nothing can be read. */
  | "unconfigured";

/**
 * How old the last success may be before the card complains.
 *
 * The workflow runs weekly, so this has to clear seven days or the card is red
 * every Sunday morning. Ten days tolerates one missed or delayed run — GitHub
 * queues scheduled workflows under load — while still catching two consecutive
 * misses, which is the point at which something is actually wrong.
 */
export const BACKUP_STALE_AFTER_MS = 10 * 24 * 60 * 60 * 1000;

/**
 * Accept the repository setting in the forms a person actually pastes.
 *
 * The documented value is `owner/repo`, but the obvious mistake is copying the
 * address bar, and `https://github.com/owner/repo` would build a nonsense API
 * path and fail as a bare 404 with nothing pointing at the cause. Cheaper to
 * accept the paste than to make someone debug it.
 *
 * Returns null for anything that is not a plain owner/repo pair rather than
 * guessing — a wrong repository silently reports another project's backups,
 * which is worse than showing "not configured".
 */
export function normalizeRepo(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");

  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : null;
}

export interface RunFigures {
  rows: number | null;
  tables: number | null;
  /** Megabytes confirmed present in R2, falling back to what was downloaded. */
  storedMb: number | null;
  storageObjects: number | null;
  /**
   * Whether the size above was read back from the bucket rather than measured
   * on the runner. The card says so, because "we downloaded 84 MB" and "84 MB
   * is sitting off-site" are different claims and only the second is a backup.
   */
  storedInR2: boolean;
}

const NOTHING: RunFigures = {
  rows: null,
  tables: null,
  storedMb: null,
  storageObjects: null,
  storedInR2: false,
};

/**
 * Read the backup's figures out of the GitHub Actions job log.
 *
 * The log is not a convenient source, it is the only one. GitHub's REST API
 * exposes a run's conclusion and its jobs, but nothing a workflow writes to
 * $GITHUB_STEP_SUMMARY — that text exists solely in the web UI. So the numbers
 * have to come from stdout, and the lines below are printed on purpose by
 * scripts/backup.ts, scripts/backup-storage.ts and the verify step in the
 * mazora-backups repository. Changing that wording there blanks this card.
 *
 * They matter because "success" proves nothing about content: a run that
 * connects, reads nothing and uploads an empty dump exits 0 and shows a green
 * tick. 576 rows is the evidence; the tick is not.
 *
 * Size prefers the "in R2" line over the downloaded total. The download only
 * proves the pull from Supabase worked; if the two disagree, the R2 figure is
 * the one describing a backup that actually exists somewhere else.
 *
 * Everything is null rather than 0 when absent. Zero rows and "we could not
 * tell" are different facts, and announcing a catastrophe that did not happen
 * is the worse of the two errors.
 */
export function parseRunLog(text: string): RunFigures {
  if (!text) return NOTHING;

  const num = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  // "✓ 576 rows from 29 tables". Anchored on "from N tables" so the per-table
  // lines above it ("public.audit_logs  310 rows") cannot match — otherwise the
  // first table's row count would be reported as the whole backup's.
  const totals = text.match(/([\d,]+)\s+rows\s+from\s+([\d,]+)\s+tables/i);

  // "in R2: 30 db objects, 54 storage objects, 84 MB" — the verify step, which
  // lists the bucket after uploading. Absent from runs made before that step
  // existed, hence the fallback below.
  const confirmed = text.match(
    /in R2:\s*([\d,]+)\s+db objects,\s*([\d,]+)\s+storage objects,\s*([\d,.]+)\s*MB/i,
  );

  // "✓ 54 downloaded (83.8 MB), 0 already present, 0 failed".
  const downloaded = text.match(/([\d,]+)\s+downloaded\s+\(([\d,.]+)\s*MB\)/i);

  return {
    rows: num(totals?.[1]),
    tables: num(totals?.[2]),
    storedMb: num(confirmed?.[3]) ?? num(downloaded?.[2]),
    storageObjects: num(confirmed?.[2]) ?? num(downloaded?.[1]),
    storedInR2: confirmed !== null,
  };
}

/**
 * Render the stored size for the card, or null when there is nothing to say.
 *
 * The dump is 84 MB today and only grows; "12288 MB" is accurate and unreadable
 * at a glance, which is the one thing this card exists for.
 *
 * Zero is treated as unknown. The workflow reports whole megabytes, so a small
 * backup rounds to 0 MB while still containing everything — printing "0 MB"
 * would suggest an empty backup that is not empty. The row count is the honest
 * evidence of emptiness, and it is shown alongside.
 */
export function formatBackupSize(mb: number | null): string | null {
  if (!mb || mb < 0) return null;
  if (mb < 1024) return `${mb} MB`;
  const gb = mb / 1024;
  // One decimal, but never a trailing ".0" — 1 GB, not 1.0 GB.
  return `${Number(gb.toFixed(1))} GB`;
}

export interface BackupRun {
  /** GitHub's run conclusion: "success", "failure", … or null while running. */
  conclusion: string | null;
  /** ISO timestamp the run finished, or null while running. */
  finishedAt: string | null;
  /** Parsed out of the run's job summary when present. */
  rows: number | null;
  tables: number | null;
  storedMb: number | null;
  storageObjects: number | null;
  storedInR2: boolean;
  url: string;
}

export interface BackupAssessment {
  health: BackupHealth;
  /** Milliseconds since the run finished, or null when that cannot be known. */
  ageMs: number | null;
}

function millis(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

/**
 * Turn the last run into a state for the card.
 *
 * `configured` is separate from a missing run on purpose. "No token set" and
 * "the backup has never run" look identical from here but need opposite
 * responses — one is a five-second settings change, the other is an incident —
 * and a card that says FAILED for an unset environment variable sends someone
 * debugging the wrong thing entirely.
 *
 * An unreadable timestamp reports `late`, never `healthy`. We cannot prove the
 * backup is recent, so we must not imply that it is; showing an unknown age
 * prompts someone to look, which is the correct outcome when the truth is
 * unknown.
 */
export function assessBackup(
  run: BackupRun | null,
  now: number,
  configured: boolean,
): BackupAssessment {
  if (!configured) return { health: "unconfigured", ageMs: null };
  if (!run) return { health: "never", ageMs: null };

  // Still executing: GitHub leaves conclusion null until a run settles.
  if (run.conclusion === null) return { health: "running", ageMs: null };
  if (run.conclusion !== "success") return { health: "failed", ageMs: null };

  const finished = millis(run.finishedAt);
  if (!Number.isFinite(finished)) return { health: "late", ageMs: null };

  // Clamp at zero: clock skew between GitHub and this server should never
  // render as a negative age.
  const ageMs = Math.max(0, now - finished);
  return { health: ageMs > BACKUP_STALE_AFTER_MS ? "late" : "healthy", ageMs };
}

/** Compact "2 days ago" style age for the card. */
export function formatBackupAge(ageMs: number | null): string {
  if (ageMs === null) return "unknown";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
