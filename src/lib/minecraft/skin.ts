import type { PlayerSkin, SkinSourceKind } from "@/lib/types";

/**
 * One definition of "which image represents this Minecraft player", the way
 * avatar-source.ts owns the same question for website accounts.
 *
 * The simplification worth knowing: mc-heads already returns the default skin
 * for a name with no Mojang account, so premium and cracked players resolve to
 * the SAME url. The Mojang lookup therefore never chooses the image — it only
 * chooses the label, and whether to invite the player to upload their skin.
 * That is why a failed lookup is harmless here.
 */

export function mcHeadsAvatarUrl(username: string, px: number): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${px}`;
}

export function mcHeadsBodyUrl(username: string, px: number): string {
  return `https://mc-heads.net/body/${encodeURIComponent(username)}/${px}`;
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

const HEAD_PX = 96;
const BODY_PX = 256;

/** Only genuine uploaded storage URLs count as uploaded skins (not third-party lookups like mc-heads). */
function isSelfUploadedSkin(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.hostname.includes("mc-heads.net")) return false;
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
      bodyUrl: mcHeadsBodyUrl(username, BODY_PX),
      source: "uploaded",
    };
  }

  if (isSelfUploadedSkin(input.uploadedRawSkinUrl)) {
    const version = bodyVersionToken(input.uploadedRawSkinUrl);
    return {
      headUrl: isSelfUploadedSkin(input.uploadedHeadUrl)
        ? input.uploadedHeadUrl
        : mcHeadsAvatarUrl(username, HEAD_PX),
      bodyUrl: `/api/minecraft/skin/${encodeURIComponent(username)}/body?v=${encodeURIComponent(version)}`,
      source: "uploaded",
    };
  }

  const source: SkinSourceKind =
    input.mojang === "premium" ? "mojang" : input.mojang === "cracked" ? "default" : "unknown";

  return {
    headUrl: mcHeadsAvatarUrl(username, HEAD_PX),
    bodyUrl: mcHeadsBodyUrl(username, BODY_PX),
    source,
  };
}
