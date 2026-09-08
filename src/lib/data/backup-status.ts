import "server-only";
import { cache } from "react";
import { assessBackup, normalizeRepo, type BackupAssessment, type BackupRun } from "@/lib/backup-status";

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

/**
 * Pull the row and table counts out of the run's job summary.
 *
 * The workflow writes "- Rows: 576" into `$GITHUB_STEP_SUMMARY`, which is the
 * one place the numbers survive after the runner is destroyed. They are the
 * only evidence the backup contained anything: a run that connects, reads
 * nothing and uploads an empty dump still exits 0 and still shows a green tick.
 *
 * Best-effort — a missing summary is not an error, just an unknown count.
 */
function parseCounts(text: string): { rows: number | null; tables: number | null } {
  const rows = text.match(/Rows:\s*(\d+)/i);
  const tables = text.match(/Tables:\s*(\d+)/i);
  return {
    rows: rows ? Number(rows[1]) : null,
    tables: tables ? Number(tables[1]) : null,
  };
}

async function fetchLatestRun(token: string, repo: string): Promise<BackupRun | null> {
  const url = `${GITHUB_API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
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

  // The counts live in the job summary, which is a second request. Skipped for
  // a run that is still going or that failed — there is nothing to report yet,
  // and the card does not need a number to say "failed".
  let counts: { rows: number | null; tables: number | null } = { rows: null, tables: null };
  if (latest.conclusion === "success") {
    try {
      const jobs = await fetch(
        `${GITHUB_API}/repos/${repo}/actions/runs/${latest.id}/jobs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: "no-store",
        },
      );
      if (jobs.ok) counts = parseCounts(await jobs.text());
    } catch {
      /* counts are a nicety; never fail the card over them */
    }
  }

  return {
    conclusion: latest.conclusion,
    finishedAt: latest.updated_at,
    url: latest.html_url,
    ...counts,
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
