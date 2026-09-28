/**
 * Link checks for URLs that staff type into settings and later appear as an
 * href. zod's `.url()` accepts any scheme the URL parser does, including
 * `javascript:` and `data:`, so it cannot be the only check.
 */

/** An absolute https:// URL with a host and no user:password@ part. */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** A path on this site: "/images/x.webp", never "//evil.example" or "/\evil.example" (which browsers read as another host). */
export function isSitePath(value: string): boolean {
  return value.startsWith("/") && !/^\/[/\\]/.test(value) && !/[\t\n\r]/.test(value);
}

/** A path on this site ("/news", not "//evil.example" or "/\evil.example"), or an https URL. */
export function isSafeLink(value: string): boolean {
  if (value.startsWith("/")) return isSitePath(value);
  return isHttpsUrl(value);
}
