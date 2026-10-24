import { safeNext } from "@/lib/safe-redirect";

/**
 * Dynamic support links are rendered as anchors, so reject executable and off-site internal URLs.
 *
 * Kept apart from lib/data/support-settings, which reads the database, so the
 * check can be imported and tested without the server-only database client.
 */
export function isSafeSupportHref(value: string, external: boolean): boolean {
  const href = value.trim();
  if (external) {
    try {
      const url = new URL(href);
      return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  return href.startsWith("/") && safeNext(href) === href;
}
