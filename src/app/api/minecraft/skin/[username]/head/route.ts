import { NextRequest, NextResponse } from "next/server";
import { cropAndCompositeHead, validateSkinBytes } from "@/lib/skins/process";
import { readSkinBody } from "@/lib/skins/read-body";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";
import { fetchWithDeadline } from "@/lib/data/upstream";
import { mcHeadsAvatarUrl } from "@/lib/minecraft/skin";
import { mojangProfileId, mojangSkinTextureUrl } from "@/lib/minecraft/mojang-skin";

/**
 * A player's head, drawn here from the skin Mojang currently has for the name.
 *
 * Players without an uploaded skin used to be shown straight from mc-heads.net,
 * which caches every size separately: a premium player could appear with their
 * skin at one size and as Steve at another, so the same person looked different
 * on the team page and the player directory. This reads the skin file from
 * Mojang (the same lookup mc-heads makes) and crops the face and hat layer with
 * the code that processes uploaded skins.
 *
 * Anything this cannot answer (a name with no Mojang account, a default skin,
 * Mojang slow or rate-limiting) is handed to mc-heads as before, so the worst
 * case is the old behaviour.
 *
 * Mojang allows a few hundred lookups per ten minutes, and a directory page
 * shows dozens of heads, so results are kept in memory (and at the edge for
 * signed-out visitors; middleware marks responses to signed-in ones private).
 */

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const MOJANG_TIMEOUT_MS = 3_000;
const MOJANG_HEADERS = { "User-Agent": "MazoraNetworkWebsite/1.0" };
const HEAD_CACHE_MS = 6 * 60 * 60_000;
const MISS_CACHE_MS = 10 * 60_000;
const CACHE_LIMIT = 500;

/** Rendered heads by lowercased name; null = use mc-heads for now. */
const heads = new Map<string, { png: Uint8Array<ArrayBuffer> | null; expiresAt: number }>();

function remember(key: string, png: Uint8Array<ArrayBuffer> | null) {
  heads.delete(key);
  heads.set(key, { png, expiresAt: Date.now() + (png ? HEAD_CACHE_MS : MISS_CACHE_MS) });
  // Oldest first in insertion order: drop from the front past the limit.
  while (heads.size > CACHE_LIMIT) heads.delete(heads.keys().next().value as string);
}

function headResponse(png: Uint8Array<ArrayBuffer>) {
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}

function fallback(username: string) {
  return NextResponse.redirect(mcHeadsAvatarUrl(username, 256), {
    status: 307,
    // Short: a miss is often Mojang being slow, and the next try should ask again.
    headers: { "Cache-Control": "public, max-age=600, s-maxage=600" },
  });
}

async function jsonFrom(response: Response | null): Promise<unknown> {
  if (!response?.ok) return null;
  return response.json().catch(() => null);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const limit = rateLimit(clientKey(request, "skin-head"), { limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: retryAfterHeaders(limit.retryAfter) });
  }

  const { username } = await params;
  if (!IGN_PATTERN.test(username)) return fallback("Steve");

  const key = username.toLowerCase();
  const cached = heads.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.png ? headResponse(cached.png) : fallback(username);

  const png = await renderHead(username);
  remember(key, png);
  return png ? headResponse(png) : fallback(username);
}

/** The head from the skin Mojang has for this name, or null when there is none to draw. */
async function renderHead(username: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const id = mojangProfileId(
    await jsonFrom(
      await fetchWithDeadline(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
        { headers: MOJANG_HEADERS, cache: "no-store" },
        MOJANG_TIMEOUT_MS,
      ),
    ),
  );
  if (!id) return null;

  const skinUrl = mojangSkinTextureUrl(
    await jsonFrom(
      await fetchWithDeadline(
        `https://sessionserver.mojang.com/session/minecraft/profile/${id}`,
        { headers: MOJANG_HEADERS, cache: "no-store" },
        MOJANG_TIMEOUT_MS,
      ),
    ),
  );
  if (!skinUrl) return null;

  const upstream = await fetchWithDeadline(skinUrl, { cache: "no-store", redirect: "error" }, MOJANG_TIMEOUT_MS);
  if (!upstream?.ok) return null;

  const bytes = await readSkinBody(upstream);
  const valid = bytes ? validateSkinBytes(bytes) : null;
  if (!bytes || !valid?.ok) return null;

  try {
    return new Uint8Array(await cropAndCompositeHead(bytes, valid.format));
  } catch {
    return null;
  }
}
