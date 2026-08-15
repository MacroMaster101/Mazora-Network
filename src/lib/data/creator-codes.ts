import "server-only";
import { and, desc, eq, getTableColumns, isNotNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { SOCIAL_PLATFORM_KEYS, type CreatorSocial } from "@/lib/creator-socials";

/**
 * Creator code repositories. Reads only — writes go through the validated
 * server actions in "@/lib/actions/creator-codes".
 *
 * Every read degrades to an empty result without DATABASE_URL, matching the
 * rest of src/lib/data: a missing database shows an empty state, never an error
 * page and never invented content.
 */

export interface CreatorCode {
  id: string;
  code: string;
  creatorName: string;
  discordUsername: string | null;
  socials: CreatorSocial[];
  percentOff: number;
  enabled: boolean;
  expiresAt: string | null;
  internalNote: string | null;
  /** Hand-picked eligibility. Empty means the code discounts nothing. */
  productIds: string[];
  createdAt: string;
}

export interface CreatorCodeStats {
  codeId: string;
  /** Orders carrying the code, excluding rejected ones. */
  placed: number;
  /** Orders staff actually confirmed. */
  confirmed: number;
  /** Subtotal driven, summed over confirmed orders only. */
  revenue: number;
  /** Discount given, summed over confirmed orders only. */
  discountGiven: number;
}

/**
 * Narrows the stored jsonb back to the typed shape.
 *
 * The column is jsonb, so Drizzle hands it back as `unknown` — anything written
 * before a validation rule existed, or by hand in SQL, has to be filtered out
 * here rather than trusted into the UI.
 */
function toSocials(value: unknown): CreatorSocial[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as { platform?: unknown; url?: unknown };
    if (typeof entry.platform !== "string" || typeof entry.url !== "string") return [];
    if (!SOCIAL_PLATFORM_KEYS.includes(entry.platform as never)) return [];
    return [{ platform: entry.platform as CreatorSocial["platform"], url: entry.url }];
  });
}

/** Uppercase + trim. Applied to every write and every lookup, without exception. */
export function normaliseCode(value: string): string {
  return value.trim().toUpperCase();
}

function toCreatorCode(
  row: typeof schema.creatorCodes.$inferSelect,
  productIds: string[],
): CreatorCode {
  return {
    id: row.id,
    code: row.code,
    creatorName: row.creatorName,
    discordUsername: row.discordUsername,
    socials: toSocials(row.socials),
    percentOff: row.percentOff,
    enabled: row.enabled,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    internalNote: row.internalNote,
    productIds,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every code, newest first. Admin only — callers must authorize first. */
export async function getCreatorCodes(): Promise<CreatorCode[]> {
  const db = getDb();
  if (!db) return [];
  try {
    /*
      Fetch codes and their eligibility in one statement. The previous two-step
      read left the Store hub suspended if the second `IN ($1)` query lost its
      client while a navigation was cancelled; the pooler then showed that read
      waiting on ClientRead indefinitely. A join has one lifecycle and cannot
      strand the page between "codes loaded" and "products loaded".
    */
    const rows = await db
      .select({
        ...getTableColumns(schema.creatorCodes),
        eligibleProductId: schema.creatorCodeProducts.productId,
      })
      .from(schema.creatorCodes)
      .leftJoin(
        schema.creatorCodeProducts,
        eq(schema.creatorCodeProducts.codeId, schema.creatorCodes.id),
      )
      .orderBy(desc(schema.creatorCodes.createdAt));

    const grouped = new Map<
      string,
      { row: typeof schema.creatorCodes.$inferSelect; productIds: string[] }
    >();
    for (const { eligibleProductId, ...row } of rows) {
      const entry = grouped.get(row.id) ?? { row, productIds: [] };
      if (eligibleProductId) entry.productIds.push(eligibleProductId);
      grouped.set(row.id, entry);
    }
    return [...grouped.values()].map(({ row, productIds }) => toCreatorCode(row, productIds));
  } catch (error) {
    console.error("Failed to load creator codes:", error);
    return [];
  }
}

/**
 * A code a buyer may actually redeem right now: it exists, is enabled, and has
 * not expired. Returns null for all three failure modes so the checkout can
 * give one generic answer rather than confirming which codes exist.
 */
export async function getRedeemableCreatorCode(code: string): Promise<CreatorCode | null> {
  const db = getDb();
  const normalised = normaliseCode(code);
  if (!db || !normalised) return null;
  try {
    const rows = await db
      .select({
        ...getTableColumns(schema.creatorCodes),
        eligibleProductId: schema.creatorCodeProducts.productId,
      })
      .from(schema.creatorCodes)
      .leftJoin(
        schema.creatorCodeProducts,
        eq(schema.creatorCodeProducts.codeId, schema.creatorCodes.id),
      )
      .where(eq(schema.creatorCodes.code, normalised))
      .orderBy(schema.creatorCodeProducts.productId);
    if (rows.length === 0) return null;
    const { eligibleProductId: _firstProductId, ...row } = rows[0];
    if (!row || !row.enabled) return null;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

    const productIds = rows.flatMap(({ eligibleProductId }) =>
      eligibleProductId ? [eligibleProductId] : [],
    );
    return toCreatorCode(row, productIds);
  } catch (error) {
    console.error("Failed to load creator code:", error);
    return null;
  }
}

/**
 * Attribution per code.
 *
 * Placed and confirmed are counted separately because a pending order is not
 * revenue, and the money figures sum over confirmed orders alone so a rejected
 * or abandoned request never inflates a creator's numbers.
 */
export async function getCreatorCodeStats(): Promise<Map<string, CreatorCodeStats>> {
  const stats = new Map<string, CreatorCodeStats>();
  const db = getDb();
  if (!db) return stats;

  try {
    /*
      Aggregated in SQL rather than by reading the table.

      This used to be `db.select().from(schema.orders)` with the filtering and
      summing done in JavaScript — every column of every order ever placed,
      pulled into the lambda on each render of the admin Store hub, growing
      without bound. It also defeated `orders_creator_code_idx`, the partial
      index migration 023 adds for exactly this query.

      "completed" is a confirmed order whose ticket was closed, so it counts as
      confirmed business. "rejected" is excluded from every figure, including
      `placed`, so an abandoned request never inflates a creator's numbers.
    */
    const rows = await db
      .select({
        codeId: schema.orders.creatorCodeId,
        placed: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${schema.orders.status} in ('confirmed', 'completed'))`,
        revenue: sql<number>`coalesce(sum(coalesce(${schema.orders.subtotalAmount}, ${schema.orders.totalAmount}, 0)) filter (where ${schema.orders.status} in ('confirmed', 'completed')), 0)`,
        discountGiven: sql<number>`coalesce(sum(coalesce(${schema.orders.discountAmount}, 0)) filter (where ${schema.orders.status} in ('confirmed', 'completed')), 0)`,
      })
      .from(schema.orders)
      .where(and(isNotNull(schema.orders.creatorCodeId), ne(schema.orders.status, "rejected")))
      .groupBy(schema.orders.creatorCodeId);

    for (const row of rows) {
      if (!row.codeId) continue;
      stats.set(row.codeId, {
        codeId: row.codeId,
        // Postgres returns bigint/numeric aggregates as strings over the wire.
        placed: Number(row.placed ?? 0),
        confirmed: Number(row.confirmed ?? 0),
        revenue: Number(row.revenue ?? 0),
        discountGiven: Number(row.discountGiven ?? 0),
      });
    }
  } catch (error) {
    console.error("Failed to load creator code stats:", error);
  }
  return stats;
}
