import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cleanAndUnwrapImageUrl } from "@/lib/utils";

/**
 * Permanent hosting for news images.
 *
 * Discord CDN attachment links are signed and expire within about a day, so a
 * stored Discord URL is guaranteed to rot. Every image therefore gets copied
 * into our own Supabase bucket at import time and served from there. That also
 * means a staff member can always restore the announcement's original artwork:
 * the object key is derived from the Discord message id, so the original stays
 * addressable even after someone replaces or removes the article's image.
 */

export const NEWS_IMAGE_BUCKET = "news-images";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

type ImageMime = keyof typeof MIME_EXTENSIONS;

/** Content sniffing — never trust a Content-Type header or a file extension. */
function detectedMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 6)).startsWith("GIF8")) return "image/gif";
  return null;
}

async function ensureBucket(): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data } = await admin.storage.getBucket(NEWS_IMAGE_BUCKET);
  if (data) return true;
  const { error } = await admin.storage.createBucket(NEWS_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
  });
  return !error || /already exists/i.test(error.message);
}

/** Public URL for an object already in the bucket, or null when absent. */
export async function publicUrlIfExists(objectKey: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const slash = objectKey.lastIndexOf("/");
  const folder = slash === -1 ? "" : objectKey.slice(0, slash);
  const name = slash === -1 ? objectKey : objectKey.slice(slash + 1);
  const { data } = await admin.storage.from(NEWS_IMAGE_BUCKET).list(folder, { search: name, limit: 1 });
  if (!data?.some((item) => item.name === name)) return null;
  return admin.storage.from(NEWS_IMAGE_BUCKET).getPublicUrl(objectKey).data.publicUrl;
}

export interface StoredImage {
  url: string;
  key: string;
}

/** Persist raw bytes under a stable key. Returns null if the bytes are not a real image. */
export async function storeImageBytes(bytes: Uint8Array, keyBase: string): Promise<StoredImage | null> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  const mime = detectedMime(bytes);
  if (!mime) return null;

  const admin = getSupabaseAdmin();
  if (!admin || !(await ensureBucket())) return null;

  const key = `${keyBase}.${MIME_EXTENSIONS[mime]}`;
  const { error } = await admin.storage.from(NEWS_IMAGE_BUCKET).upload(key, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) return null;

  return { url: admin.storage.from(NEWS_IMAGE_BUCKET).getPublicUrl(key).data.publicUrl, key };
}

/**
 * Download a remote image and re-host it. Only http(s) is followed, and the
 * response is validated by content sniffing rather than by its declared type,
 * so a hostile URL cannot smuggle a non-image through.
 */
export async function rehostImageFromUrl(url: string, keyBase: string): Promise<StoredImage | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  // Unwrap Google Images / Imgur page links before fetching
  const cleaned = cleanAndUnwrapImageUrl(parsed.toString());
  let fetchUrl: URL;
  try {
    fetchUrl = new URL(cleaned);
  } catch {
    fetchUrl = parsed;
  }

  try {
    const res = await fetch(fetchUrl.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    return await storeImageBytes(bytes, keyBase);
  } catch {
    return null;
  }
}

/** Stable object key for an announcement's original artwork. */
export function discordOriginalKey(discordMessageId: string): string {
  return `discord/${discordMessageId}`;
}
