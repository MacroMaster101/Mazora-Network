import { realDisplayName } from "@/lib/auth/placeholder";

/**
 * The name a member's action is credited with where OTHER members read it:
 * reply notifications and gallery credits.
 *
 * Built from the member's own profile row only. `Session.displayName` falls
 * back to the sign-in provider's metadata when the profile has no display name,
 * and `user_metadata` is writable by the member straight through Supabase's
 * API, past every check the profile form makes. Text written there could then
 * appear in someone else's notifications under any name the member liked. The
 * profile row is written only by the site's validated profile action.
 *
 * "New Player" is the signup trigger's placeholder, not a chosen name, so it
 * gives way to the username, as it does everywhere the session builds a name.
 * Pure, so the rule is tested directly.
 */
export function profileName(
  profile: { displayName?: string | null; username?: string | null } | null | undefined,
  fallback: string,
): string {
  const display = realDisplayName(profile?.displayName);
  if (display) return display;
  const username = typeof profile?.username === "string" ? profile.username.trim() : "";
  return username || fallback;
}
