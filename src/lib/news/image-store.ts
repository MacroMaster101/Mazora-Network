import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
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

const DEFAULT_REMOTE_IMAGE_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
  "i.imgur.com",
]);

function approvedRemoteImageHost(hostname: string): boolean {
  const configured = (process.env.REMOTE_IMAGE_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return DEFAULT_REMOTE_IMAGE_HOSTS.has(hostname.toLowerCase()) || configured.includes(hostname.toLowerCase());
}

async function readLimitedBody(response: Response): Promise<Uint8Array | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

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
 * Address ranges the server must never be talked into fetching: loopback,
 * RFC1918 private space, carrier NAT, and — most importantly — the
 * 169.254.0.0/16 link-local range that cloud providers use for their instance
 * metadata endpoints.
 */
function isBlockedAddress(ip: string): boolean {
  if (isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Non-routable/documentation ranges must fail closed too. They are often
    // routed internally by development networks and cloud sidecars even
    // though they are not ordinary RFC1918 space.
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51) return true;
    if (a === 203 && b === 0) return true;
    if (a >= 224) return true; // multicast, reserved, and limited broadcast
    return false;
  }
  if (isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
    const firstHextet = Number.parseInt(low.split(":", 1)[0] || "0", 16);
    if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true; // fe80::/10 link-local
    if (firstHextet >= 0xff00 && firstHextet <= 0xffff) return true; // multicast
    if (low.startsWith("2001:db8:")) return true; // documentation prefix

    // IPv4-mapped IPv6 can be emitted in dotted or hexadecimal form. Checking
    // only ::ffff:127.0.0.1 misses the canonical ::ffff:7f00:1 spelling.
    const dotted = low.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isBlockedAddress(dotted[1]);
    const mappedHex = low.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16);
      const lowWord = Number.parseInt(mappedHex[2], 16);
      return isBlockedAddress(
        `${high >>> 8}.${high & 0xff}.${lowWord >>> 8}.${lowWord & 0xff}`,
      );
    }
    return false;
  }
  return true; // unparseable — fail closed
}

/** Resolves the host and refuses anything pointing into private space. */
async function resolvesToPublicAddress(target: URL): Promise<boolean> {
  try {
    const results = await dnsLookup(target.hostname, { all: true });
    return results.length > 0 && results.every((entry) => !isBlockedAddress(entry.address));
  } catch {
    return false;
  }
}

/**
 * Download a remote image and re-host it. The response is validated by content
 * sniffing rather than by its declared type, so a hostile URL cannot smuggle a
 * non-image through.
 *
 * The URL is attacker-controlled in practice: any signed-in member can submit
 * gallery artwork by link, so this is a server-side request they get to aim.
 * Redirects are therefore followed by hand and every hop is re-resolved and
 * re-checked — validating only the first URL would let a public host bounce the
 * request to 169.254.169.254 or a service on localhost.
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
    let current = fetchUrl;
    let res: Response | null = null;

    for (let hop = 0; hop < 4; hop++) {
      if (current.protocol !== "https:" && current.protocol !== "http:") return null;
      if (!approvedRemoteImageHost(current.hostname)) return null;
      if (!(await resolvesToPublicAddress(current))) return null;

      res = await fetch(current.toString(), {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        try {
          current = new URL(location, current);
        } catch {
          return null;
        }
        continue;
      }
      break;
    }

    if (!res || !res.ok) return null;

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) return null;

    const bytes = await readLimitedBody(res);
    if (!bytes) return null;
    return await storeImageBytes(bytes, keyBase);
  } catch {
    return null;
  }
}

/** Stable object key for an announcement's original artwork. */
export function discordOriginalKey(discordMessageId: string): string {
  return `discord/${discordMessageId}`;
}
