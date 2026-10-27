"use server";

import { revalidatePath } from "next/cache";
import { getSession, getSessionUserId } from "@/lib/auth";
import { hasAtLeast } from "@/lib/auth/roles";
import { recordAudit } from "@/lib/audit-log";
import { dispatchBackup } from "@/lib/data/backup-status";
import { accountKey, claimOnce, peekRateLimitShared, rateLimit, rateLimitShared, releaseClaim } from "@/lib/rate-limit";

export interface BackupActionResult {
  ok: boolean;
  message: string;
}

/**
 * One manual backup per half hour, for the whole site rather than per person:
 * the limit protects the database and the Actions minutes, which are shared.
 */
const MANUAL_BACKUP_WINDOW_MS = 30 * 60 * 1000;
const MANUAL_BACKUP_KEY = "backup-dispatch";

const MESSAGES = {
  "already-running": "A backup is already running. Wait for it to finish.",
  unconfigured: "Backups are not connected: set GITHUB_BACKUP_TOKEN and GITHUB_BACKUP_REPO.",
  "no-write-access": "GitHub refused to start the run. The backup token needs Actions: Read and write on the backups repository.",
  failed: "GitHub could not be reached to start the backup. Try again in a minute.",
} as const;

/**
 * "Run backup now" on the settings page's backup card: owner and Web Dev only,
 * the same gate as the card itself. A run only adds a backup, so a click and a
 * confirm are enough; it is rate limited and written to the audit log.
 */
export async function runBackupNow(): Promise<BackupActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  if (!session || !userId || !hasAtLeast(session.role, "owner")) {
    return { ok: false, message: "Only the owner and Web Dev can start a backup." };
  }

  // Each click costs two or three GitHub API calls, started or not.
  if (!rateLimit(accountKey("backup-dispatch-clicks", userId), { limit: 5, windowMs: 60_000 }).ok) {
    return { ok: false, message: "Too many tries. Wait a minute." };
  }

  // Peeked first and counted only once a run has started, so a refusal (a run
  // already going, a read-only token) does not use up the half hour. Closed on
  // failure: with the shared store down, every instance would allow its own run.
  const window = { limit: 1, windowMs: MANUAL_BACKUP_WINDOW_MS, failureMode: "closed" } as const;
  const limit = await peekRateLimitShared(MANUAL_BACKUP_KEY, window);
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfter / 60));
    return { ok: false, message: `A backup was started in the last half hour. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  // Two owners clicking together would both read an empty window above; only
  // one may be starting a run at a time.
  const starting = `${MANUAL_BACKUP_KEY}:starting`;
  if ((await claimOnce(starting, 60_000)) !== "claimed") {
    return { ok: false, message: "A backup is already being started. Refresh in a moment." };
  }
  try {
    const result = await dispatchBackup();
    if (result !== "started") return { ok: false, message: MESSAGES[result] };
    await rateLimitShared(MANUAL_BACKUP_KEY, window);
  } finally {
    await releaseClaim(starting);
  }

  await recordAudit({
    action: "backup.run_now",
    actorId: userId,
    by: session.username,
    targetType: "backup",
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Backup started. It takes about two minutes; refresh this page to see it finish." };
}
