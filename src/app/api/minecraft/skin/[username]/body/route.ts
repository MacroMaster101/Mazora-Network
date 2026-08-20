import { NextRequest, NextResponse } from "next/server";
import { getLinkedSkin } from "@/lib/data/minecraft-accounts";
import { compositeBody } from "@/lib/skins/body";
import { validateSkinBytes, SKIN_MAX_BYTES } from "@/lib/skins/process";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";
import { mcHeadsBodyUrl } from "@/lib/minecraft/skin";
import { isSupabaseStorageObjectUrl } from "@/lib/storage-url";

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

/**
 * `raw_skin_url` is read from the database, and handing a database-sourced URL
 * straight to fetch is a server-side request forgery vector: one bad row would
 * make our server fetch anything the row names, from inside our network. The
 * only origin we ever fetch from is our own Supabase storage bucket, so that is
 * asserted here rather than assumed — the same discipline isMinecraftAvatarUrl
 * and providerAvatar apply to rendered image URLs.
 */
/** Returns the default Steve body image redirect so Next.js Image optimizer always gets a valid image */
function fallbackSteveResponse() {
  return NextResponse.redirect(mcHeadsBodyUrl("Steve", 256), {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
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
  if (!IGN_PATTERN.test(username)) {
    return fallbackSteveResponse();
  }

  const linked = await getLinkedSkin(username);
  if (!linked?.rawSkinUrl || !isSupabaseStorageObjectUrl(linked.rawSkinUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return fallbackSteveResponse();
  }

  const upstream = await fetch(linked.rawSkinUrl, { cache: "no-store", redirect: "error" }).catch(() => null);
  if (!upstream?.ok) {
    return fallbackSteveResponse();
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.byteLength > SKIN_MAX_BYTES) {
    return fallbackSteveResponse();
  }

  const valid = validateSkinBytes(bytes);
  if (!valid.ok) {
    return fallbackSteveResponse();
  }

  try {
    const body = await compositeBody(bytes, valid.format);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return fallbackSteveResponse();
  }
}
