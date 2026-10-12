import "server-only";
import { fetchWithDeadline } from "@/lib/data/upstream";
import { readSkinBody } from "@/lib/skins/read-body";
import { validateSkinBytes, type SkinFormat } from "@/lib/skins/process";
import { mojangProfileId, mojangSkinTextureUrl } from "@/lib/minecraft/mojang-skin";

/**
 * The skin file Mojang has for a name, for the head and body routes
 * (app/api/minecraft/skin/[username]/head and /body).
 *
 * Three requests: the name's profile id, the profile's textures, then the skin
 * file itself, which may only come from textures.minecraft.net (see
 * mojang-skin.ts). The file is size-capped while it downloads and must be a
 * real skin PNG.
 *
 * Mojang allows a few hundred lookups per ten minutes and a directory page
 * shows dozens of players, so answers are kept in memory: a skin, or "this name
 * uses the default skin", for six hours; no answer at all for ten minutes (that
 * is usually Mojang being slow, and the next request should ask again).
 */

export interface MojangSkin {
  bytes: Buffer;
  format: SkinFormat;
}

/**
 * What Mojang says about a name: its skin; "default" when no account holds the
 * name or the account uses the default skin (draw defaultSkin()); or null when
 * Mojang could not be asked, so the caller should not claim either.
 */
export type MojangSkinAnswer = MojangSkin | "default" | null;

/**
 * Mojang's own default Steve skin file. Steve is drawn from this rather than by
 * name: the account actually called "Steve" wears a custom skin (a grey cat
 * suit), which is what every "Steve" fallback through mc-heads showed.
 */
const DEFAULT_SKIN_TEXTURE =
  "https://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b";

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const TIMEOUT_MS = 3_000;
const HEADERS = { "User-Agent": "MazoraNetworkWebsite/1.0" };
const SKIN_CACHE_MS = 6 * 60 * 60_000;
const MISS_CACHE_MS = 10 * 60_000;
const CACHE_LIMIT = 500;

const skins = new Map<string, { skin: MojangSkinAnswer; expiresAt: number }>();
let defaultSkinCache: { skin: MojangSkin | null; expiresAt: number } | null = null;

function remember(key: string, skin: MojangSkinAnswer) {
  skins.delete(key);
  skins.set(key, { skin, expiresAt: Date.now() + (skin ? SKIN_CACHE_MS : MISS_CACHE_MS) });
  // Oldest first in insertion order: drop from the front past the limit.
  while (skins.size > CACHE_LIMIT) skins.delete(skins.keys().next().value as string);
}

async function jsonFrom(response: Response | null): Promise<unknown> {
  if (!response?.ok) return null;
  return response.json().catch(() => null);
}

/** The skin Mojang has for this name right now (see MojangSkinAnswer). */
export async function fetchMojangSkin(username: string): Promise<MojangSkinAnswer> {
  if (!IGN_PATTERN.test(username)) return "default";
  const key = username.toLowerCase();
  const cached = skins.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.skin;

  const skin = await loadMojangSkin(username);
  remember(key, skin);
  return skin;
}

/** Mojang's default Steve skin, kept in memory once read. Null only if Mojang cannot be reached. */
export async function defaultSkin(): Promise<MojangSkin | null> {
  if (defaultSkinCache && defaultSkinCache.expiresAt > Date.now()) return defaultSkinCache.skin;
  const skin = await downloadSkin(DEFAULT_SKIN_TEXTURE);
  defaultSkinCache = { skin, expiresAt: Date.now() + (skin ? 24 * 60 * 60_000 : MISS_CACHE_MS) };
  return skin;
}

async function loadMojangSkin(username: string): Promise<MojangSkinAnswer> {
  const profile = await fetchWithDeadline(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    { headers: HEADERS, cache: "no-store" },
    TIMEOUT_MS,
  );
  // No account holds the name (an offline-mode player): the default skin.
  if (profile?.status === 404 || profile?.status === 204) return "default";
  const id = mojangProfileId(await jsonFrom(profile));
  if (!id) return null;

  const session = await fetchWithDeadline(
    `https://sessionserver.mojang.com/session/minecraft/profile/${id}`,
    { headers: HEADERS, cache: "no-store" },
    TIMEOUT_MS,
  );
  const textures = await jsonFrom(session);
  if (!textures) return null;
  // An account with no custom skin, or with one somewhere other than Mojang's
  // texture host (which is never fetched): the default skin.
  const skinUrl = mojangSkinTextureUrl(textures);
  if (!skinUrl) return "default";

  return downloadSkin(skinUrl);
}

/** A skin file from Mojang's texture host, size-capped and checked to be a real skin. */
async function downloadSkin(url: string): Promise<MojangSkin | null> {
  const upstream = await fetchWithDeadline(url, { cache: "no-store", redirect: "error" }, TIMEOUT_MS);
  if (!upstream?.ok) return null;

  const bytes = await readSkinBody(upstream);
  const valid = bytes ? validateSkinBytes(bytes) : null;
  if (!bytes || !valid?.ok) return null;
  return { bytes, format: valid.format };
}
