import { NextRequest, NextResponse } from "next/server";
import { getLinkedSkin } from "@/lib/data/minecraft-accounts";
import { compositeBody } from "@/lib/skins/body";
import { validateSkinBytes, type SkinFormat } from "@/lib/skins/process";
import { readSkinBody } from "@/lib/skins/read-body";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";
import { DEFAULT_SKIN_NAME, isStevePlaceholder, mcHeadsBodyUrl } from "@/lib/minecraft/skin";
import { defaultSkin, fetchMojangSkin } from "@/lib/minecraft/mojang-skin-fetch";
import { isSupabaseStorageObjectUrl } from "@/lib/storage-url";

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

/**
 * A player's full body, drawn from their skin: the one they uploaded here, or
 * else the one Mojang has for the name (fetchMojangSkin), the same source the
 * head route uses. A name with no skin of its own (offline-mode players, the
 * default skin, invalid names, the "Steve" placeholder) gets Mojang's default
 * Steve, drawn the same way. mc-heads.net is only the fallback for when Mojang
 * cannot be reached: it caches each size separately and could show Steve for a
 * premium player who has a skin.
 */
function fallbackResponse(username: string | null) {
  // The default body is cached for good; a miss may be Mojang being slow, so
  // it is only cached briefly.
  return NextResponse.redirect(mcHeadsBodyUrl(username ?? DEFAULT_SKIN_NAME, 256), {
    status: 307,
    headers: {
      "Cache-Control": username
        ? "public, max-age=600, s-maxage=600"
        : "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

/**
 * The member's uploaded skin, when they have one that can be read.
 *
 * `raw_skin_url` is read from the database, and handing a database-sourced URL
 * straight to fetch is a server-side request forgery vector: one bad row would
 * make our server fetch anything the row names, from inside our network. The
 * only origin we ever fetch from is our own Supabase storage bucket, so that is
 * asserted here rather than assumed — the same discipline isMinecraftAvatarUrl
 * and providerAvatar apply to rendered image URLs.
 */
async function uploadedSkin(username: string): Promise<{ bytes: Buffer; format: SkinFormat } | null> {
  const linked = await getLinkedSkin(username);
  if (!linked?.rawSkinUrl || !isSupabaseStorageObjectUrl(linked.rawSkinUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return null;
  }

  const upstream = await fetch(linked.rawSkinUrl, { cache: "no-store", redirect: "error" }).catch(() => null);
  if (!upstream?.ok) return null;

  const bytes = await readSkinBody(upstream);
  if (!bytes) return null;

  const valid = validateSkinBytes(bytes);
  return valid.ok ? { bytes, format: valid.format } : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const limit = rateLimit(clientKey(request, "skin-body"), { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: retryAfterHeaders(limit.retryAfter) },
    );
  }

  const { username } = await params;
  const valid = IGN_PATTERN.test(username) && !isStevePlaceholder(username);
  const answer = valid ? ((await uploadedSkin(username)) ?? (await fetchMojangSkin(username))) : "default";
  const skin = answer === "default" ? await defaultSkin() : answer;
  if (!skin) return fallbackResponse(answer === "default" || !valid ? null : username);

  try {
    const body = await compositeBody(skin.bytes, skin.format);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return fallbackResponse(valid ? username : null);
  }
}
