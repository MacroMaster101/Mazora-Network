/**
 * Which image URLs next/image is actually allowed to optimise.
 *
 * Mirrors `images.remotePatterns` in next.config.ts. It exists because some
 * image URLs in this app are *snapshots* rather than known assets — a news
 * byline avatar is whatever URL the author's profile pointed at when the
 * article was published, which may be Supabase storage, the Discord CDN,
 * mc-heads, or something a future provider hands us. Passing an unconfigured
 * host to <Image> is a runtime error, so callers use this to decide and fall
 * back to a plain <img> when the host is not one we've allowed.
 *
 * Getting this wrong is safe in one direction only: a false negative costs an
 * unoptimised image, a false positive breaks the render. Keep it conservative
 * and keep it in step with next.config.ts.
 */
const OPTIMISABLE_HOSTS = new Set(["mc-heads.net", "api.dicebear.com", "cdn.discordapp.com"]);

function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isOptimisableImage(src: string): boolean {
  // Same-origin paths are always fine.
  if (src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname;
    return OPTIMISABLE_HOSTS.has(host) || host === supabaseHost();
  } catch {
    return false;
  }
}
