import "server-only";

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
/** The host that serves channel pages; the others redirect to it. */
const CANONICAL_YOUTUBE_HOST = "www.youtube.com";
const AVATAR_HOSTS = new Set(["yt3.ggpht.com", "yt3.googleusercontent.com"]);

function decodeImageUrl(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/");
}

function isYouTubeAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      AVATAR_HOSTS.has(url.hostname) || url.hostname.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

/** Extract the public channel avatar from YouTube's server-rendered metadata. */
export function youtubeAvatarFromHtml(html: string): string | null {
  const meta = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const jsonAvatar = html.match(/["']avatar["']\s*:\s*\{\s*["']thumbnails["']\s*:\s*\[\s*\{\s*["']url["']\s*:\s*["']([^"']+)/i);
  const candidate = decodeImageUrl(meta?.[1] ?? jsonAvatar?.[1] ?? "");
  return candidate && isYouTubeAvatarUrl(candidate) ? candidate : null;
}

/** Well above any real channel page. This only exists to block abuse. */
const MAX_PAGE_BYTES = 3_000_000;

/**
 * Redirects followed for one lookup. A real channel link normally needs none,
 * because the lookup starts on www.youtube.com whichever host the link named.
 */
const MAX_REDIRECTS = 3;

/** How long one lookup may take in total, redirects and page body included. */
const LOOKUP_TIMEOUT_MS = 7_000;

/** https on a YouTube page host, default port. Applied to the link and to every redirect. */
function isYouTubePageUrl(url: URL): boolean {
  return url.protocol === "https:" && url.port === "" && YOUTUBE_HOSTS.has(url.hostname);
}

/**
 * The page as text, or null once it is larger than a channel page can be.
 *
 * `response.text()` would hold the whole body in memory before its size could
 * be checked. Content-Length is only an early exit (it can be missing, and it
 * counts compressed bytes), so the running total decides. Going over the cap
 * aborts the request rather than cancelling this reader: the response is also
 * being copied into the fetch cache, and only an abort stops that copy too.
 */
async function readPageText(response: Response, controller: AbortController): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PAGE_BYTES) {
    controller.abort();
    return null;
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let html = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_PAGE_BYTES) {
      controller.abort();
      return null;
    }
    html += decoder.decode(value, { stream: true });
  }
  return html + decoder.decode();
}

/**
 * Resolve a YouTube channel/handle URL to its current public avatar.
 * The page response is cached for a day, while callers keep their own fallback
 * when YouTube is unavailable or changes its public metadata.
 *
 * Redirects are followed by hand so each hop can be held to the same rule as
 * the link itself. Left to fetch, a redirect could take the request to any
 * host at all, and the page that came back would be read as if YouTube had
 * sent it. The ordinary hop (youtube.com to www.youtube.com) passes; a bounce
 * to the cookie-consent host does not, which loses nothing because that page
 * carries no channel avatar.
 */
export async function resolveYouTubeProfileImage(channelUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(channelUrl);
  } catch {
    return null;
  }
  if (!isYouTubePageUrl(url)) return null;
  // Ask www.youtube.com directly. The other two hosts only answer with a
  // redirect to it, and the fetch cache keeps 200 responses only, so a stored
  // youtube.com or m.youtube.com link cost an uncached request on every lookup.
  // Only the first request is rewritten; a redirect is still followed as sent.
  url.hostname = CANONICAL_YOUTUBE_HOST;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetch(url, {
        headers: {
          "accept-language": "en-US,en;q=0.9",
          "user-agent": "Mozilla/5.0 (compatible; MazoraNetwork/1.0; +https://mazora.us)",
        },
        redirect: "manual",
        next: { revalidate: 86_400 },
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location) return null;
        const next = new URL(location, url);
        if (!isYouTubePageUrl(next)) return null;
        url = next;
        continue;
      }

      if (!response.ok) return null;
      const html = await readPageText(response, controller);
      return html === null ? null : youtubeAvatarFromHtml(html);
    }
    return null; // ran out of redirect hops
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
