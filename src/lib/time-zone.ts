/**
 * The member's own time zone, so emails can say "7:51 PM GMT+5:30" instead of
 * a UTC time they have to convert. The browser reports it (TimeZoneSync) and
 * it is kept on the account in user_metadata.time_zone.
 *
 * user_metadata is editable by the member, so every read goes through
 * validTimeZone: anything that is not a real IANA zone falls back to UTC.
 */

/** A real IANA zone name such as "Asia/Colombo", or null. */
export function validTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 64) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** The zone saved on an account, from its user_metadata. */
export function savedTimeZone(meta: Record<string, unknown> | null | undefined): string | null {
  return validTimeZone(meta?.time_zone);
}
