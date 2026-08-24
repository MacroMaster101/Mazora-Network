import "server-only";

import * as http from "node:http";
import * as https from "node:https";
import { lookup as dnsLookup } from "node:dns";
import type { LookupAddress } from "node:dns";
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

/*
  Host policy for remote image fetches.

  By default ANY host is allowed — a member can paste an image link from any
  site and it is re-hosted — because the real protection against SSRF is at the
  connection layer, not the hostname. Every request (and every redirect hop)
  resolves DNS through `secureLookup`, which refuses to connect to a private,
  loopback, link-local, or cloud-metadata address and hands the socket the exact
  vetted IP it then connects to. That closes the resolve-then-connect gap a DNS
  rebind would need, so an arbitrary hostname is safe to accept.

  Setting REMOTE_IMAGE_HOST_ALLOWLIST re-imposes a hard hostname allowlist (the
  built-in Discord/Imgur hosts plus whatever is listed) on top of the IP guard,
  for operators who want to lock intake down to specific CDNs.
*/
const DEFAULT_REMOTE_IMAGE_HOSTS = ["cdn.discordapp.com", "media.discordapp.net", "i.imgur.com"];

function hostAllowed(hostname: string): boolean {
  const configured = (process.env.REMOTE_IMAGE_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length === 0) return true; // open mode — any public host, IP-guarded at connect
  const allow = new Set([...DEFAULT_REMOTE_IMAGE_HOSTS, ...configured]);
  return allow.has(hostname.toLowerCase());
}

/** Drain an image response, refusing anything over the size cap mid-stream. */
function readLimitedStream(stream: http.IncomingMessage): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const finish = (value: Uint8Array | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    stream.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        stream.destroy();
        finish(null);
        return;
      }
      chunks.push(chunk);
    });
    stream.on("end", () => finish(new Uint8Array(Buffer.concat(chunks))));
    stream.on("error", () => finish(null));
    stream.on("close", () => finish(null));
  });
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

/**
 * DNS lookup used for every outbound image request. It resolves the host, drops
 * any private/loopback/link-local/metadata address, and hands the socket only a
 * vetted public IP — so the connection lands on exactly the address that was
 * validated, closing the rebind gap between checking and connecting. When
 * nothing public resolves, the connection is refused.
 *
 * Because this runs at connect time for every request and every redirect hop,
 * an arbitrary hostname can be accepted safely: a host that answers public then
 * flips to a private address still never gets connected to, since the address
 * the socket uses is the one this function already validated.
 */
function secureLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) {
      callback(err);
      return;
    }
    let publicAddrs = addresses.filter((entry) => !isBlockedAddress(entry.address));
    if (options.family === 4 || options.family === 6) {
      publicAddrs = publicAddrs.filter((entry) => entry.family === options.family);
    }
    if (publicAddrs.length === 0) {
      callback(
        Object.assign(new Error(`Refused to connect to a non-public address for ${hostname}`), {
          code: "EAI_BLOCKED",
        }),
      );
      return;
    }
    if (options.all) {
      callback(null, publicAddrs);
    } else {
      callback(null, publicAddrs[0].address, publicAddrs[0].family);
    }
  });
}

/** One GET, connecting only through secureLookup. Resolves null on any error. */
function requestImage(url: URL): Promise<http.IncomingMessage | null> {
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = transport.request(
      url,
      {
        method: "GET",
        // Fresh connection (never a pooled socket) resolved through our guard.
        agent: false,
        lookup: secureLookup as http.RequestOptions["lookup"],
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif,*/*;q=0.8",
          // Ask for no transfer compression: sidesteps decompression-bomb handling.
          "Accept-Encoding": "identity",
        },
      },
      (res) => resolve(res),
    );
    req.setTimeout(15_000, () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
}

/**
 * Download a remote image and re-host it. Accepts a link from ANY host — the
 * SSRF protection is the secureLookup connection guard, not a hostname list, so
 * arbitrary image URLs work while requests to internal addresses are refused at
 * connect time. The bytes are validated by content sniffing, not the declared
 * type, and only raster formats (JPEG/PNG/WebP/GIF) are accepted; SVG is
 * intentionally rejected because it can carry script.
 *
 * Redirects are followed by hand, and every hop reconnects through secureLookup
 * so a public host cannot bounce the request to 169.254.169.254 or localhost.
 */
export async function rehostImageFromUrl(url: string, keyBase: string): Promise<StoredImage | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  // Unwrap Google Images / Imgur page links before fetching.
  const cleaned = cleanAndUnwrapImageUrl(parsed.toString());
  let current: URL;
  try {
    current = new URL(cleaned);
  } catch {
    current = parsed;
  }

  let response: http.IncomingMessage | null = null;
  for (let hop = 0; hop < 4; hop += 1) {
    if (current.protocol !== "https:" && current.protocol !== "http:") return null;
    if (!hostAllowed(current.hostname)) return null;

    response = await requestImage(current);
    if (!response) return null;

    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400) {
      const location = response.headers.location;
      response.resume(); // drain the redirect body so the socket can close
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      response = null;
      continue;
    }
    break;
  }

  if (!response) return null; // ran out of redirect hops

  const status = response.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    response.resume();
    return null;
  }

  const declared = Number(response.headers["content-length"] ?? 0);
  if (declared > MAX_IMAGE_BYTES) {
    response.destroy();
    return null;
  }

  const bytes = await readLimitedStream(response);
  if (!bytes) return null;
  return storeImageBytes(bytes, keyBase);
}

/** Stable object key for an announcement's original artwork. */
export function discordOriginalKey(discordMessageId: string): string {
  return `discord/${discordMessageId}`;
}
