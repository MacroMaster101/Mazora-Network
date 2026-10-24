import { z } from "zod";

/**
 * Shared guard for identifiers that reach a Postgres `uuid` column.
 *
 * Admin actions receive ids straight from FormData. Handing a non-UUID string
 * to a `uuid` column raises `invalid input syntax for type uuid`, which — in an
 * action without a try/catch — trips the admin error boundary instead of
 * returning a clean message. Validating the shape up front keeps a malformed or
 * probing value from ever reaching the query.
 */
const uuidSchema = z.string().uuid();

/** True when `value` is a syntactically valid UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidSchema.safeParse(value).success;
}

/**
 * A Postgres array literal of UUIDs, passed as ONE query parameter and cast
 * with `::uuid[]`.
 *
 * Drizzle's `sql` template expands a JS array into one parameter per item, and
 * Postgres allows 65,535 parameters per statement, so a list of thousands of
 * ids has to travel as a single literal instead. Anything that is not a UUID is
 * dropped, so nothing but hex digits and hyphens ever reaches the literal.
 */
export function uuidArrayLiteral(ids: Iterable<unknown>): string {
  const valid = [...new Set([...ids].filter(isUuid).map((id) => id.toLowerCase()))];
  return `{${valid.join(",")}}`;
}
