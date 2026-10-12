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
