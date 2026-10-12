import { NextRequest, NextResponse } from "next/server";
import { cropAndCompositeHead } from "@/lib/skins/process";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";
import { mcHeadsAvatarUrl } from "@/lib/minecraft/skin";
import { fetchMojangSkin } from "@/lib/minecraft/mojang-skin-fetch";

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
 * Anything this cannot answer (a name with no Mojang account, a default skin,
 * Mojang slow or rate-limiting) is handed to mc-heads as before, so the worst
 * case is the old behaviour. Drawn heads are also cached at the edge for
 * signed-out visitors; middleware marks responses to signed-in ones private.
 */

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

function fallback(username: string) {
  return NextResponse.redirect(mcHeadsAvatarUrl(username, 256), {
    status: 307,
    // Short: a miss is often Mojang being slow, and the next try should ask again.
    headers: { "Cache-Control": "public, max-age=600, s-maxage=600" },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const limit = rateLimit(clientKey(request, "skin-head"), { limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: retryAfterHeaders(limit.retryAfter) });
  }

  const { username } = await params;
  if (!IGN_PATTERN.test(username)) return fallback("Steve");

  const skin = await fetchMojangSkin(username);
  if (!skin) return fallback(username);

  try {
    return new NextResponse(new Uint8Array(await cropAndCompositeHead(skin.bytes, skin.format)), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return fallback(username);
  }
}
