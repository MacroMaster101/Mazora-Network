/**
 * One definition of "which photo represents this account", shared by the
 * session (`getSession`) and the admin account lists (`lib/data/accounts`) so
 * the header, sidebars and staff boards can never disagree about a member's
 * avatar.
 *
 * Order: the avatar they chose in profile settings (an upload, a Minecraft
 * skin, or their Discord photo — all stored in `profiles.avatar_url` by our own
 * server actions) and only then the photo that came with their sign-in
 * provider. Callers render a monogram when both are absent.
 */

/**
 * Hosts trusted for a sign-in provider's photo. `user_metadata` is writable by
 * the account holder, so an arbitrary URL there must never be rendered into a
 * page — the same rule `getDiscordIdentity` applies to Discord avatars.
 *
 * These must stay in step with the `img-src` allowlist in `lib/csp.ts`: a host
 * trusted here but missing there is silently blocked by the browser, which
 * looks like "this member has no photo" rather than like an error.
 */
const PROVIDER_AVATAR_HOSTS = ["googleusercontent.com", "cdn.discordapp.com"];

/** The provider photo for an auth user, or null when there isn't a safe one. */
export function providerAvatar(metadata: Record<string, unknown> | null | undefined): string | null {
  const raw = metadata?.avatar_url ?? metadata?.picture;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    const allowed = PROVIDER_AVATAR_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The avatar to display for an account: chosen first, provider second. */
export function resolveAvatarUrl(
  chosen: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const picked = typeof chosen === "string" && chosen.trim() ? chosen.trim() : null;
  return picked ?? providerAvatar(metadata);
}
