/**
 * Pure Discord-identity selection, with no server-only dependencies (no
 * "next/headers", no Supabase client). Kept separate from "@/lib/auth" for the
 * same reason roles.ts is: that module pulls in server-only code, so anything
 * importable from a Client Component — or from a test — has to live outside it.
 * "@/lib/auth" re-exports this for existing server-side callers.
 */

/**
 * The Discord identity that should represent the account right now.
 *
 * An account can end up holding more than one Discord identity (linking a
 * second account succeeds server-side even though nothing in the UI offers it),
 * and `Array.find` would then return whichever happens to sit first — in
 * practice the oldest, so a user who switched accounts kept seeing their
 * previous username. Ordering by recency picks the one they actually last used,
 * which is also the one Supabase signs them in as.
 */
export function pickDiscordIdentity<
  T extends { provider: string; updated_at?: string; last_sign_in_at?: string; created_at?: string },
>(identities: T[] | undefined | null): T | undefined {
  const discord = (identities ?? []).filter((entry) => entry.provider === "discord");
  if (discord.length <= 1) return discord[0];
  const freshness = (entry: T) =>
    Date.parse(entry.updated_at ?? entry.last_sign_in_at ?? entry.created_at ?? "") || 0;
  return [...discord].sort((a, b) => freshness(b) - freshness(a))[0];
}
