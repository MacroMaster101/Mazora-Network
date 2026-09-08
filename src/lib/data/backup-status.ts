import "server-only";
import { cache } from "react";
import {
  assessBackup,
  normalizeRepo,
  parseRunLog,
  type BackupAssessment,
  type BackupRun,
  type RunFigures,
} from "@/lib/backup-status";

export * from "@/lib/backup-status";

/**
 * Reads the outcome of the last off-site backup from the private ops
 * repository's GitHub Actions history.
 *
 * The backup itself runs in `mazora-backups`, on a schedule, and uploads to
 * Cloudflare R2. That separation is deliberate — the database credentials and
 * the service-role key live only in that private repository, never here — so
 * this application has no way to perform a backup and no way to read one. All
 * it can do is observe whether the workflow ran, which is exactly the amount of
 * access this card needs.
 *
 * The token is therefore a *different* credential from anything that touches
 * data: a fine-grained PAT with `Actions: read` on one repository. If this
 * application were compromised, that token reads workflow metadata. It cannot
 * reach the database, the dumps, or the bucket.
 */

const GITHUB_API = "https://api.github.com";
const WORKFLOW_FILE = "backup.yml";
const REQUEST_TIMEOUT_MS = 5_000;
/*
  A job log is a few tens of kilobytes today. The cap is not about that — it is
  about never letting a page render pull an unbounded body because something
  upstream started looping and wrote a gigabyte of stack traces.
*/
const MAX_LOG_BYTES = 5_000_000;

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Fetch the run's job log and read the backup figures out of it.
 *
 * The log is the only place those numbers are reachable. GitHub's REST API
 * returns a run's conclusion and its jobs, but nothing a workflow writes to
 * $GITHUB_STEP_SUMMARY — that text lives only in the web UI. An earlier version
 * of this file parsed the jobs JSON for it and therefore always found nothing,
 * which is why the card showed a state but never a count.
 *
 * Two requests: the jobs list to learn the job id, then the log itself, which
 * answers with a redirect to signed blob storage. The Authorization header is
 * dropped on that cross-origin hop by fetch, which is both correct and required
 * — the storage host rejects it.
 */
async function fetchRunFigures(token: string, repo: string, runId: number): Promise<RunFigures> {
  const jobs = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/jobs`, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!jobs.ok) return NO_FIGURES;

  const body = (await jobs.json()) as { jobs?: { id: number }[] };
  const jobId = body.jobs?.[0]?.id;
  if (!jobId) return NO_FIGURES;

  const log = await fetch(`${GITHUB_API}/repos/${repo}/actions/jobs/${jobId}/logs`, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!log.ok) return NO_FIGURES;

  const size = Number(log.headers.get("content-length"));
  if (Number.isFinite(size) && size > MAX_LOG_BYTES) return NO_FIGURES;

  return parseRunLog(await log.text());
}

const NO_FIGURES: RunFigures = {
  rows: null,
  tables: null,
  storedMb: null,
  storageObjects: null,
  storedInR2: false,
};

export interface BackupStatus extends BackupAssessment {
  run: BackupRun | null;
  /** Set when the lookup itself failed, as opposed to the backup failing. */
  error: string | null;
}

function config() {
  const token = process.env.GITHUB_BACKUP_TOKEN?.trim();
  // Tolerates a pasted GitHub URL, and returns null for anything that is not a
  // plain owner/repo pair — see normalizeRepo.
  const repo = normalizeRepo(process.env.GITHUB_BACKUP_REPO);
  return token && repo ? { token, repo } : null;
}

async function fetchLatestRun(token: string, repo: string): Promise<BackupRun | null> {
  const url = `${GITHUB_API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`;
  const response = await fetch(url, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

  const body = (await response.json()) as {
    workflow_runs?: {
      conclusion: string | null;
      updated_at: string | null;
      html_url: string;
      id: number;
    }[];
  };
  const latest = body.workflow_runs?.[0];
  if (!latest) return null;

  // Skipped for a run that is still going or that failed: there is nothing to
  // count yet, and the card does not need a number in order to say "failed".
  let figures = NO_FIGURES;
  if (latest.conclusion === "success") {
    try {
      figures = await fetchRunFigures(token, repo, latest.id);
    } catch {
      /* the figures are a nicety; never fail the card over them */
    }
  }

  return {
    conclusion: latest.conclusion,
    finishedAt: latest.updated_at,
    url: latest.html_url,
    ...figures,
  };
}

/**
 * Cached per request so the card and any future consumer share one round trip.
 *
 * Never throws. This renders inside the settings page, and a GitHub outage must
 * not take that page down — an unreachable API becomes a visible "could not
 * check" on the card, which is honest and stays out of the way.
 */
export const getBackupStatus = cache(async (): Promise<BackupStatus> => {
  const settings = config();
  if (!settings) {
    return { ...assessBackup(null, Date.now(), false), run: null, error: null };
  }

  try {
    const run = await fetchLatestRun(settings.token, settings.repo);
    return { ...assessBackup(run, Date.now(), true), run, error: null };
  } catch (error) {
    return {
      health: "late",
      ageMs: null,
      run: null,
      error: error instanceof Error ? error.message : "The backup status could not be read.",
    };
  }
});
