/**
 * Helpers for recognising the values the SQL signup trigger writes when an
 * account arrives with no username / display_name of its own.
 *
 * `handle_new_user` (see supabase/migrations) does:
 *   coalesce(raw_user_meta_data->>'username',     'player_' || substr(id,1,8))
 *   coalesce(raw_user_meta_data->>'display_name', 'New Player')
 *
 * Every OAuth signup (Google, Discord) carries a name and email but no
 * `username` in its metadata, so the trigger stores these placeholders. They
 * are not names the member chose, so they must never win over the real name
 * derivable from the account's email or provider metadata — otherwise the same
 * person shows up as "player_9d6a48d4 / New Player" on the Users board while
 * showing their email handle in the control-room widget.
 *
 * Pure (no server-only, no imports) so both server data loaders and the session
 * resolver can share the one definition.
 */

/** The trigger's fallback display name. */
export const PLACEHOLDER_DISPLAY_NAME = "New Player";

/**
 * True when a stored profile username is the trigger's generated placeholder:
 * `player_` followed by the first 8 characters of the account UUID. When the
 * account id is known the match is exact; otherwise it falls back to the shape,
 * which a real chosen handle is vanishingly unlikely to collide with.
 */
export function isPlaceholderUsername(
  username: string | null | undefined,
  userId?: string | null,
): boolean {
  const value = (username ?? "").trim().toLowerCase();
  if (!value) return false;
  if (userId) return value === `player_${userId.slice(0, 8).toLowerCase()}`;
  return /^player_[0-9a-f]{8}$/.test(value);
}

/** A display name to actually show, or null when it is only the placeholder. */
export function realDisplayName(displayName: string | null | undefined): string | null {
  const value = typeof displayName === "string" ? displayName.trim() : "";
  return value && value !== PLACEHOLDER_DISPLAY_NAME ? value : null;
}
