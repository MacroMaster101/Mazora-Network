/**
 * Helpers for recognising the values the SQL signup trigger writes when an
 * account arrives with no username / display_name of its own.
 *
 * `handle_new_user` (see supabase/migrations) does:
 *   coalesce(raw_user_meta_data->>'username',     'player_' || substr(id,1,8))
 *   coalesce(raw_user_meta_data->>'display_name', 'New Player')
 *
 * Every OAuth signup (Google, Discord) carries a name and email but no
 * `username` in its metadata, so the trigger stores these placeholders. The
 * username placeholder is kept as the account's name until the member picks
 * one (siteUsername): it is what they sign in with, and the email handle it
 * once gave way to is often a real name nobody chose to publish. "New Player"
 * is not a name and still gives way to the provider's name (realDisplayName).
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

/** The placeholder username for an account: `player_` and the first 8 characters of its id. */
export function placeholderUsername(userId: string): string {
  return `player_${userId.slice(0, 8).toLowerCase()}`;
}

/**
 * True when a username is only the account's email local part: what
 * resolveUsername falls back to, and what migration 031's derive_username
 * stored (sanitised to [A-Za-z0-9_], at most 24 characters, 16 since 076,
 * with the unique_username suffixes for a name someone else already held).
 * That is often a real name, and nobody chose to publish it. Migration 081
 * renames the stored ones with the same forms.
 */
export function isEmailDerivedUsername(
  username: string | null | undefined,
  email: string | null | undefined,
  userId: string,
): boolean {
  const value = (username ?? "").trim().toLowerCase();
  const local = (email ?? "").split("@")[0]?.trim().toLowerCase() ?? "";
  if (!value || !local) return false;
  const clean = local.replace(/[^a-z0-9_]/g, "");
  const id = userId.toLowerCase();
  const forms = (base: string) => [base, `${base.slice(0, 15)}_${id.slice(0, 8)}`, `${base.slice(0, 8)}_${id.replace(/-/g, "").slice(0, 12)}`];
  return [local, ...forms(clean.slice(0, 24)), ...forms(clean.slice(0, 16))].includes(value);
}

/**
 * The site username for an account, used by the admin lists (resolveUsername)
 * and matching what getSession shows the member.
 *
 * The profile's username wins, the `player_<uuid8>` placeholder included: it is
 * what the account signs in with. Only an account with no profile row falls
 * back, to a metadata username that is not just the email handle (old staff
 * invites stored that), then to the placeholder. Never to the email handle.
 */
export function siteUsername(input: {
  profileUsername?: string | null;
  metadataUsername?: unknown;
  email?: string | null;
  userId?: string | null;
}): string {
  const profile = typeof input.profileUsername === "string" ? input.profileUsername.trim() : "";
  if (profile) return profile;
  const metadata = typeof input.metadataUsername === "string" ? input.metadataUsername.trim() : "";
  if (metadata && !isEmailDerivedUsername(metadata, input.email, input.userId ?? "")) return metadata;
  return input.userId ? placeholderUsername(input.userId) : "player";
}

/** The name to show the public: the account's own choice, never its email handle. */
export function publicUsername(account: { username: string; email: string | null; userId: string }): string {
  return isEmailDerivedUsername(account.username, account.email, account.userId) ? placeholderUsername(account.userId) : account.username;
}
