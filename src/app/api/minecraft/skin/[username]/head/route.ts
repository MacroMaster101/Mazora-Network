import { NextRequest, NextResponse } from "next/server";
import { cropAndCompositeHead } from "@/lib/skins/process";
import { clientKey, rateLimitShared, retryAfterHeaders } from "@/lib/rate-limit";
import { DEFAULT_SKIN_NAME, isStevePlaceholder, mcHeadsAvatarUrl } from "@/lib/minecraft/skin";
import { defaultSkin, fetchMojangSkin } from "@/lib/minecraft/mojang-skin-fetch";

/**
 * A player's head, drawn here from the skin Mojang currently has for the name.
 *
 * Players without an uploaded skin used to be shown straight from mc-heads.net,
 * which caches every size separately: a premium player could appear with their
 * skin at one size and as Steve at another, so the same person looked different
 * on the team page and the player directory. This reads the skin file from
 * Mojang (fetchMojangSkin, which also keeps it in memory) and crops the face
 * and hat layer with the code that processes uploaded skins.
 *
 * A name with no Mojang account (an offline-mode player), an account on the
 * default skin, an invalid name and the "Steve" placeholder all get Mojang's
 * default Steve, drawn the same way. Only when Mojang cannot be reached is the
 * request handed to mc-heads, as before. Drawn heads are also cached at the
 * edge for signed-out visitors; middleware marks responses to signed-in ones
 * private.
 */

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

function fallback(username: string) {
  return NextResponse.redirect(mcHeadsAvatarUrl(username, 256), {
    status: 307,
    // Only reached when Mojang could not be asked, so never kept: a browser that
    // held this redirect showed mc-heads (often Steve) after Mojang was back.
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const limit = await rateLimitShared(clientKey(request, "skin-head"), { limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: retryAfterHeaders(limit.retryAfter) });
  }

  const { username } = await params;
  const valid = IGN_PATTERN.test(username) && !isStevePlaceholder(username);
  const answer = valid ? await fetchMojangSkin(username) : "default";
  const skin = answer === "default" ? await defaultSkin() : answer;
  if (!skin) return fallback(answer === "default" || !valid ? DEFAULT_SKIN_NAME : username);

  try {
    return new NextResponse(new Uint8Array(await cropAndCompositeHead(skin.bytes, skin.format)), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return fallback(valid ? username : DEFAULT_SKIN_NAME);
  }
}
