/**
 * Group Discord identity rows by the site account that owns them.
 *
 * Pure so it can be tested: the query that feeds it lives in
 * `data/accounts.ts`, which is server-only. Same split as
 * `discord-roles-shared.ts`.
 */

export interface DiscordIdentityRow {
  userId: unknown;
  providerId: unknown;
}

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Build a userId → Discord ids map.
 *
 * A user may hold SEVERAL Discord identities — one real account here does. The
 * previous code read only the first, so picking a person's second Discord
 * account in the composer matched nothing and the rank control silently
 * disappeared. Every id is kept, and matching checks them all.
 *
 * `identity_data` is jsonb with no schema behind it, so anything that is not a
 * snowflake is dropped rather than trusted. A user left with no valid id is
 * absent from the map, not present with an empty array — callers should not
 * have to distinguish "no Discord" from "Discord, but unusable".
 */
export function buildDiscordIdentityMap(
  rows: readonly DiscordIdentityRow[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const row of rows) {
    const userId = typeof row.userId === "string" ? row.userId.trim() : "";
    const providerId = typeof row.providerId === "string" ? row.providerId.trim() : "";
    if (!userId || !SNOWFLAKE.test(providerId)) continue;

    const existing = map.get(userId);
    if (!existing) {
      map.set(userId, [providerId]);
    } else if (!existing.includes(providerId)) {
      existing.push(providerId);
    }
  }

  return map;
}
