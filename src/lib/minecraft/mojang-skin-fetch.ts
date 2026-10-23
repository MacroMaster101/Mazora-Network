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
 * uses the default skin", for six hours. When Mojang does not answer (slow, or
 * rate-limiting us) the last answer for the name is used again rather than
 * nothing: a player who has been drawn once keeps their skin through an outage
 * instead of dropping to mc-heads, which can show Steve for them.
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
const TIMEOUT_MS = 5_000;
const HEADERS = { "User-Agent": "MazoraNetworkWebsite/1.0" };
const SKIN_CACHE_MS = 6 * 60 * 60_000;
const MISS_CACHE_MS = 10 * 60_000;
const CACHE_LIMIT = 500;
// "No such profile" and "could not ask" answers live in their own small cache so
// a run of made-up names (valid-looking, never a real account) can only churn
// this one, never evict the real players' skins held in `skins`.
const MISS_CACHE_LIMIT = 200;

const skins = new Map<string, { skin: MojangSkinAnswer; expiresAt: number }>();
const misses = new Map<string, { skin: MojangSkinAnswer; expiresAt: number }>();
let defaultSkinCache: { skin: MojangSkin | null; expiresAt: number } | null = null;

function remember(key: string, skin: MojangSkinAnswer) {
  skins.delete(key);
  skins.set(key, { skin, expiresAt: Date.now() + (skin ? SKIN_CACHE_MS : MISS_CACHE_MS) });
  // Oldest first in insertion order: drop from the front past the limit.
  while (skins.size > CACHE_LIMIT) skins.delete(skins.keys().next().value as string);
}

function rememberMiss(key: string, skin: MojangSkinAnswer) {
  misses.delete(key);
  misses.set(key, { skin, expiresAt: Date.now() + MISS_CACHE_MS });
  while (misses.size > MISS_CACHE_LIMIT) misses.delete(misses.keys().next().value as string);
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
  const missed = misses.get(key);
  if (missed && missed.expiresAt > Date.now()) return missed.skin;

  const skin = await loadMojangSkin(username);
  // No answer: keep the last one we had (asked again after the miss window).
  if (skin === null && cached?.skin) {
    skins.set(key, { skin: cached.skin, expiresAt: Date.now() + MISS_CACHE_MS });
    return cached.skin;
  }
  if (skin === "missing") {
    rememberMiss(key, "default");
    return "default";
  }
  // A name we have never held a skin for and could not reach Mojang about also
  // stays out of the main cache.
  if (skin === null && !cached) {
    rememberMiss(key, null);
    return null;
  }
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

/** As MojangSkinAnswer, plus "missing": Mojang says no account holds the name. */
async function loadMojangSkin(username: string): Promise<MojangSkinAnswer | "missing"> {
  const profile = await fetchWithDeadline(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    { headers: HEADERS, cache: "no-store" },
    TIMEOUT_MS,
  );
  // No account holds the name (an offline-mode player): the default skin.
  if (profile?.status === 404 || profile?.status === 204) return "missing";
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
