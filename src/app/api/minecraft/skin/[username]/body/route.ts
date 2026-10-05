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

/**
 * The upstream body, or null once it turns out to be larger than a skin can be.
 *
 * `arrayBuffer()` would hold the whole object in memory before its size could
 * be checked, and this route is public. Content-Length is only an early exit:
 * the header can be missing or wrong, so the running total is what decides, and
 * the download is cancelled the moment it passes the cap.
 */
async function readSkinBody(upstream: Response): Promise<Buffer | null> {
  const declared = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > SKIN_MAX_BYTES) {
    await upstream.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!upstream.body) return null;

  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > SKIN_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks, total);
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

  const bytes = await readSkinBody(upstream);
  if (!bytes) {
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
