/**
 * Same-origin redirect target validation.
 *
 * Extracted from the OAuth callback so it can be tested directly: this is the
 * only thing standing between a `?next=` query parameter and an open redirect,
 * and an open redirect on a login callback is a phishing primitive — the victim
 * genuinely signs in to mazora.us and is then handed to the attacker's page
 * with the referrer intact.
 */

/**
 * Restricts a redirect target to a same-origin path, or returns "/".
 *
 * Checking only for a leading "//" is not enough. Browsers strip ASCII tab, CR
 * and LF from anywhere in a URL and treat a backslash exactly like a forward
 * slash before resolving it (WHATWG URL spec), so "/\evil.com" and
 * "/\t/evil.com" both pass a naive `startsWith("/") && !startsWith("//")`
 * check and then resolve to https://evil.com the moment a browser follows
 * `new URL(next, origin)`. Normalising the same way the browser will, *before*
 * deciding, is what closes that bypass.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  const normalized = value.replace(/[\t\r\n]/g, "").replace(/\\/g, "/");
  return normalized.startsWith("/") && !normalized.startsWith("//") ? normalized : "/";
}
