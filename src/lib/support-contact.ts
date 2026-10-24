/**
 * The public support address, shown where the site itself cannot help: the
 * error pages and the outage notice.
 *
 * It comes from NEXT_PUBLIC_SUPPORT_EMAIL, never from source: this repository
 * is public. Unset or malformed, there is no address and callers hide the
 * line. It is read with a literal `process.env.NEXT_PUBLIC_…` so Next inlines
 * it into the client bundle, which the error pages need: they must work even
 * when the server and the database are the thing that failed.
 */

const EMAIL = /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+\.[a-z]{2,}$/i;

/** A usable address, or null. Exported for the tests. */
export function parseSupportEmail(value: string | undefined): string | null {
  const email = value?.trim() ?? "";
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export const supportEmail: string | null = parseSupportEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);

/**
 * A mailto link with a subject the support inbox can sort on. The incident code
 * is the digest the error page shows and onRequestError logs, so the report can
 * be matched to its log line; nothing else about the failure goes in it.
 */
export function supportMailto(email: string, incident?: string): string {
  const code = incident && /^[\w-]{1,64}$/.test(incident) ? ` (incident ${incident})` : "";
  return `mailto:${email}?subject=${encodeURIComponent(`Mazora site problem${code}`)}`;
}
