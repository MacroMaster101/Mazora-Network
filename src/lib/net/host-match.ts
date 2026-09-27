/**
 * Exact hostname matching. `url.includes("mc-heads.net")` also accepts
 * `evil-mc-heads.net` and `mc-heads.net.example.com`; these only accept the
 * domain itself or a real subdomain of it.
 */
export function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const target = domain.toLowerCase();
  return host === target || host.endsWith(`.${target}`);
}

/** hostMatches for a full URL string; false for relative paths and anything that does not parse. */
export function urlHostMatches(url: string | null | undefined, domain: string): boolean {
  if (!url) return false;
  try {
    return hostMatches(new URL(url).hostname, domain);
  } catch {
    return false;
  }
}
