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
 * shows dozens of players, so answers are kept in memory: a skin for six hours,
 * "nothing to draw" for ten minutes (that is often Mojang being slow).
 */

export interface MojangSkin {
  bytes: Buffer;
  format: SkinFormat;
}

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const TIMEOUT_MS = 3_000;
const HEADERS = { "User-Agent": "MazoraNetworkWebsite/1.0" };
const SKIN_CACHE_MS = 6 * 60 * 60_000;
const MISS_CACHE_MS = 10 * 60_000;
const CACHE_LIMIT = 500;

const skins = new Map<string, { skin: MojangSkin | null; expiresAt: number }>();

function remember(key: string, skin: MojangSkin | null) {
  skins.delete(key);
  skins.set(key, { skin, expiresAt: Date.now() + (skin ? SKIN_CACHE_MS : MISS_CACHE_MS) });
  // Oldest first in insertion order: drop from the front past the limit.
  while (skins.size > CACHE_LIMIT) skins.delete(skins.keys().next().value as string);
}

async function jsonFrom(response: Response | null): Promise<unknown> {
  if (!response?.ok) return null;
  return response.json().catch(() => null);
}

/** The current Mojang skin for this name, or null when there is none to draw. */
export async function fetchMojangSkin(username: string): Promise<MojangSkin | null> {
  if (!IGN_PATTERN.test(username)) return null;
  const key = username.toLowerCase();
  const cached = skins.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.skin;

  const skin = await loadMojangSkin(username);
  remember(key, skin);
  return skin;
}

async function loadMojangSkin(username: string): Promise<MojangSkin | null> {
  const id = mojangProfileId(
    await jsonFrom(
      await fetchWithDeadline(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
        { headers: HEADERS, cache: "no-store" },
        TIMEOUT_MS,
      ),
    ),
  );
  if (!id) return null;

  const skinUrl = mojangSkinTextureUrl(
    await jsonFrom(
      await fetchWithDeadline(
        `https://sessionserver.mojang.com/session/minecraft/profile/${id}`,
        { headers: HEADERS, cache: "no-store" },
        TIMEOUT_MS,
      ),
    ),
  );
  if (!skinUrl) return null;

  const upstream = await fetchWithDeadline(skinUrl, { cache: "no-store", redirect: "error" }, TIMEOUT_MS);
  if (!upstream?.ok) return null;

  const bytes = await readSkinBody(upstream);
  const valid = bytes ? validateSkinBytes(bytes) : null;
  if (!bytes || !valid?.ok) return null;
  return { bytes, format: valid.format };
}
