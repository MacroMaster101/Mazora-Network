/**
 * Creator social platforms.
 *
 * Client-safe on purpose: the admin form (a Client Component) and the server
 * action that validates submissions both read this list, so it must not pull in
 * "server-only". Keeping one list stops the picker and the validator drifting.
 */

export const SOCIAL_PLATFORMS = [
  { key: "youtube", label: "YouTube" },
  { key: "twitch", label: "Twitch" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "x", label: "X" },
  { key: "kick", label: "Kick" },
  { key: "discord", label: "Discord server" },
  { key: "website", label: "Website" },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["key"];

export const SOCIAL_PLATFORM_KEYS = SOCIAL_PLATFORMS.map((item) => item.key) as SocialPlatform[];

export interface CreatorSocial {
  platform: SocialPlatform;
  url: string;
}

export function socialLabel(platform: string): string {
  return SOCIAL_PLATFORMS.find((item) => item.key === platform)?.label ?? platform;
}

/**
 * Accepts only absolute http(s) URLs.
 *
 * These are rendered as links in the admin, so a `javascript:` or `data:` value
 * would be a stored-XSS vector the moment someone clicks it. Parsing with the URL
 * constructor and allowlisting the protocol is what makes that impossible —
 * checking for a leading "http" in a string is not the same thing.
 */
export function isValidSocialUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Profile images must come from a host allowed by both CSP and next.config. */
export function isValidCreatorImageUrl(value: string): boolean {
  const input = value.trim();
  if (!input) return true;
  if (input.startsWith("/images/") && !input.includes("..")) return true;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return false;
    const allowed = new Set([
      "mc-heads.net",
      "api.dicebear.com",
      "cdn.discordapp.com",
      "media.discordapp.net",
      "lh3.googleusercontent.com",
    ]);
    if (allowed.has(url.hostname) || url.hostname.endsWith(".googleusercontent.com")) return true;
    const storage = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!storage) return false;
    const storageUrl = new URL(storage);
    return url.hostname === storageUrl.hostname && url.pathname.startsWith("/storage/v1/object/");
  } catch {
    return false;
  }
}
