import "server-only";

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
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

/**
 * Resolve a YouTube channel/handle URL to its current public avatar.
 * The page response is cached for a day, while callers keep their own fallback
 * when YouTube is unavailable or changes its public metadata.
 */
export async function resolveYouTubeProfileImage(channelUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(channelUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname)) return null;

  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (compatible; MazoraNetwork/1.0; +https://mazora.us)",
      },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return null;
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > 3_000_000) return null;
    const html = await response.text();
    if (html.length > 3_000_000) return null;
    return youtubeAvatarFromHtml(html);
  } catch {
    return null;
  }
}
