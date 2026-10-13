import type { PlayerSkin, SkinSourceKind } from "@/lib/types";
import { hostMatches } from "@/lib/net/host-match";

/**
 * One definition of "which image represents this Minecraft player", the way
 * avatar-source.ts owns the same question for website accounts.
 *
 * The simplification worth knowing: the site's head and body routes draw the
 * skin Mojang has and fall back to the default skin for a name with no Mojang
 * account, so premium and cracked players resolve to the SAME url. The Mojang
 * lookup here therefore never chooses the image — it only chooses the label,
 * and whether to invite the player to upload their skin. That is why a failed
 * lookup is harmless here.
 */

/**
 * The name mc-heads should draw when a player has no skin: MHF_Steve holds
 * Mojang's default Steve. The account actually named "Steve" wears a custom
 * skin (a grey cat suit), so it must never be used as the stand-in.
 */
export const DEFAULT_SKIN_NAME = "MHF_Steve";

/**
 * "Steve" is what screens pass when they have no name yet. The head and body
 * routes draw the default skin for it instead of looking that account up.
 */
export function isStevePlaceholder(username: string): boolean {
  return username.toLowerCase() === "steve";
}

export function mcHeadsAvatarUrl(username: string, px: number): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${px}`;
}

export function mcHeadsBodyUrl(username: string, px: number): string {
  return `https://mc-heads.net/body/${encodeURIComponent(username)}/${px}`;
}

/**
 * The site's own head image for a player without an uploaded skin, drawn from
 * the skin Mojang has for the name (app/api/minecraft/skin/[username]/head).
 * mc-heads.net caches each size separately and can show Steve for a premium
 * player at one size and their skin at another; the route falls back to it
 * only when Mojang has nothing to draw.
 */
export function playerHeadUrl(username: string): string {
  return `/api/minecraft/skin/${encodeURIComponent(username)}/head`;
}

/**
 * The site's own full-body image (app/api/minecraft/skin/[username]/body): the
 * uploaded skin when there is one, else the skin Mojang has, else mc-heads.
 */
export function playerBodyUrl(username: string): string {
  return `/api/minecraft/skin/${encodeURIComponent(username)}/body`;
}

/**
 * The full skin file uploaded together with an uploaded head.
 *
 * A skin upload stores `skin-raw-<ts>.png` and `skin-head-<ts>.png` side by
 * side in the member's folder of the profile-avatars bucket
 * (actions/minecraft.ts). A member whose skin is only kept as their profile
 * picture (no linked Minecraft account, so no raw_skin_url on record) still has
 * that raw file, and the body must be drawn from it or it would not match the
 * head. Only that exact shape is accepted; anything else gives null.
 */
export function rawSkinUrlForHead(headUrl: string | null | undefined): string | null {
  if (!headUrl) return null;
  try {
    const url = new URL(headUrl);
    if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) return null;
    const match = /^(\/storage\/v1\/object\/public\/profile-avatars\/[0-9a-f-]{36}\/)skin-head-(\d{10,16})\.png$/i.exec(url.pathname);
    return match ? `${url.origin}${match[1]}skin-raw-${match[2]}.png` : null;
  } catch {
    return null;
  }
}

/**
 * How a stored profile picture is shown. Choosing "Minecraft skin" saves an
 * mc-heads.net head URL, and mc-heads can serve Steve for a premium player at
 * any given size, so a saved mc-heads head is shown through the site's head
 * route instead (same player, current Mojang skin). Uploads, Discord, Google
 * and anything else pass through unchanged.
 */
export function displayAvatarUrl(url: string): string;
export function displayAvatarUrl(url: string | null | undefined): string | null | undefined;
export function displayAvatarUrl(url: string | null | undefined): string | null | undefined {
  const name = mcHeadsAvatarName(url);
  return name ? playerHeadUrl(name) : url;
}

/** The player name in an mc-heads.net head URL (such as a saved profile picture), or null. */
export function mcHeadsAvatarName(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!hostMatches(url.hostname, "mc-heads.net")) return null;
    const [, kind, name] = url.pathname.split("/");
    if (kind !== "avatar" || !name) return null;
    const decoded = decodeURIComponent(name);
    return /^[A-Za-z0-9_]{3,16}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** "unknown" means the lookup did not run or did not answer — never a claim. */
export type MojangResult = "premium" | "cracked" | "unknown";

export interface ResolveSkinInput {
  username: string;
  /** minecraft_accounts.skin_head_url */
  uploadedHeadUrl?: string | null;
  /** minecraft_accounts.raw_skin_url */
  uploadedRawSkinUrl?: string | null;
  mojang?: MojangResult;
}


/** Only genuine uploaded storage URLs count as uploaded skins (not third-party lookups like mc-heads). */
function isSelfUploadedSkin(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (hostMatches(url.hostname, "mc-heads.net")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * A stable version token for the body route's URL, derived from the uploaded
 * raw skin's own filename (`skin-raw-<ms>.png`) rather than `Date.now()`. Same
 * uploaded file -> same token -> same URL -> cacheable; a re-upload writes a
 * new filename, so the token changes and the image-optimizer cache is forced
 * to refetch instead of serving the previous body forever.
 */
function bodyVersionToken(rawSkinUrl: string): string {
  const match = /skin-raw-(\d+)\.png/.exec(rawSkinUrl);
  return match ? match[1] : "v1";
}

export function resolvePlayerSkin(input: ResolveSkinInput): PlayerSkin {
  const { username } = input;

  if (isSelfUploadedSkin(input.uploadedHeadUrl) && !isSelfUploadedSkin(input.uploadedRawSkinUrl)) {
    return {
      headUrl: input.uploadedHeadUrl,
      bodyUrl: playerBodyUrl(username),
      source: "uploaded",
    };
  }

  if (isSelfUploadedSkin(input.uploadedRawSkinUrl)) {
    const version = bodyVersionToken(input.uploadedRawSkinUrl);
    return {
      headUrl: isSelfUploadedSkin(input.uploadedHeadUrl)
        ? input.uploadedHeadUrl
        : playerHeadUrl(username),
      bodyUrl: `${playerBodyUrl(username)}?v=${encodeURIComponent(version)}`,
      source: "uploaded",
    };
  }

  const source: SkinSourceKind =
    input.mojang === "premium" ? "mojang" : input.mojang === "cracked" ? "default" : "unknown";

  return {
    headUrl: playerHeadUrl(username),
    bodyUrl: playerBodyUrl(username),
    source,
  };
}
