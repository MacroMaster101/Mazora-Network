/** Tiny classnames joiner (no external dep). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Compact number, e.g. 18432 -> "18.4K", 2400000 -> "2.4M". */
export function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Full number with thousands separators. */
export function withCommas(n: number): string {
  return new Intl.NumberFormat("en").format(n);
}

/** Currency in USD. */
export function usd(n: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(n);
}

/** Human date, e.g. "Jul 8, 2026". */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "3 days ago" / "just now" style relative time. */
export function relative(iso: string): string {
  if (iso === "now") return "online now";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

/** Kill/death ratio to one decimal. */
export function kd(kills: number, deaths: number): string {
  return (kills / Math.max(deaths, 1)).toFixed(2);
}

/** Playtime hours -> "842h" or "1,204h". */
export function playtime(hours: number): string {
  return `${withCommas(hours)}h`;
}

/** Deterministic accent for a string (used for avatar fallbacks). */
export function accentFor(seed: string): string {
  const palette = ["#8b5cf6", "#a855f7", "#7c3aed", "#818cf8", "#e879f9", "#c084fc", "#9333ea"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/**
 * Automatically cleans and unwraps direct image links from pasted URLs
 * (e.g. Google Image search page redirects across any domain, Imgur page links, raw quotes/spaces).
 */
export function cleanAndUnwrapImageUrl(raw: string): string {
  if (!raw) return "";
  let url = raw.trim().replace(/^["']|["']$/g, "");
  if (!url) return "";

  // Data URLs return directly
  if (url.startsWith("data:image/")) return url;

  try {
    // 1. Google Images Search Result redirect parameter extraction (imgurl= / url= / imgrefurl=)
    // Matches google.com, google.co.uk, google.ca, images.google.com, etc.
    const googleImgUrlMatch = url.match(/[?&](?:imgurl|url)=([^&]+)/i);
    if (googleImgUrlMatch && googleImgUrlMatch[1]) {
      const decoded = decodeURIComponent(googleImgUrlMatch[1]);
      if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
        url = decoded;
      }
    }

    // 2. Imgur page URL unwrap (e.g. https://imgur.com/a/abcxyz or https://imgur.com/abcxyz)
    const imgurMatch = url.match(/https?:\/\/(?:www\.)?imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]{5,12})$/i);
    if (imgurMatch && imgurMatch[1]) {
      url = `https://i.imgur.com/${imgurMatch[1]}.png`;
    }

    // 3. Strip trailing URL anchors/hash if present
    url = url.replace(/#.*$/, "");
  } catch {
    // Fall back to trimmed raw string
  }

  return url;
}
