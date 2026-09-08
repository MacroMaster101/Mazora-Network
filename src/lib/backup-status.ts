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

export interface BackupRun {
  /** GitHub's run conclusion: "success", "failure", … or null while running. */
  conclusion: string | null;
  /** ISO timestamp the run finished, or null while running. */
  finishedAt: string | null;
  /** Parsed out of the run's job summary when present. */
  rows: number | null;
  tables: number | null;
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
