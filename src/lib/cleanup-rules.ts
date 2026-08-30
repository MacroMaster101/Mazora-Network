/**
 * Pure selection rules for the unconfirmed-account reaper — no server-only
 * dependencies, so the rule is unit tested directly. The reaper that actually
 * deletes (DB + admin client) lives in src/lib/data/cleanup-unconfirmed.ts.
 */

/** How long an unconfirmed self-signup may hold its name before it is reaped. */
export const UNCONFIRMED_TTL_MS = 48 * 60 * 60 * 1000;

/** The subset of an auth user the reaper reads. */
export interface AuthUserLike {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}

/**
 * Which accounts an expiry run should delete: self-signups that were never
 * confirmed, never signed in, are NOT invitations, and are older than `ttlMs`.
 *
 * The invitation guard matters: an invited staff member is also "unconfirmed"
 * until they accept, so without excluding `invited_at` this would silently
 * revoke pending staff invites.
 */
export function selectExpiredUnconfirmed<T extends AuthUserLike>(users: T[], now: number, ttlMs: number): T[] {
  const cutoff = now - ttlMs;
  return users.filter((user) => {
    if (user.email_confirmed_at || user.confirmed_at) return false; // already confirmed
    if (user.last_sign_in_at) return false; // has signed in at least once
    if (user.invited_at) return false; // a pending invitation, not a self-signup
    const created = user.created_at ? new Date(user.created_at).getTime() : Number.NaN;
    return Number.isFinite(created) && created < cutoff;
  });
}
