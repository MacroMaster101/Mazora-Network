import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listAllAuthUsers } from "@/lib/data/accounts";
import { selectExpiredUnconfirmed, UNCONFIRMED_TTL_MS, type AuthUserLike } from "@/lib/cleanup-rules";

/** Cap per run so a backlog never pushes the cron past its 30s function limit. */
const MAX_DELETES_PER_RUN = 100;

export interface CleanupResult {
  ok: boolean;
  scanned: number;
  deleted: number;
  message?: string;
}

/**
 * Delete expired unconfirmed accounts. Each `deleteUser` fires the
 * `prepare_account_delete` trigger and the ON DELETE CASCADE, so the freed
 * account's profile and Minecraft link (and thus its username + IGN) go with
 * it. Failures are logged and skipped rather than aborting the whole run.
 */
export async function cleanupUnconfirmedAccounts(now = Date.now()): Promise<CleanupResult> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, scanned: 0, deleted: 0, message: "Admin client is not configured." };

  const { users, error } = await listAllAuthUsers(admin);
  if (error) return { ok: false, scanned: 0, deleted: 0, message: error };

  const expired = selectExpiredUnconfirmed(users as unknown as AuthUserLike[], now, UNCONFIRMED_TTL_MS).slice(
    0,
    MAX_DELETES_PER_RUN,
  );

  let deleted = 0;
  for (const user of expired) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Failed to reap unconfirmed account", user.id, deleteError.message);
      continue;
    }
    deleted += 1;
  }

  return { ok: true, scanned: users.length, deleted };
}
