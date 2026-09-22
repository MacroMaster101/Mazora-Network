import "server-only";
import { getRedeemableCreatorCode, type CreatorCode } from "@/lib/data/creator-codes";
import { applyCreatorCode, type DiscountInputLine, type DiscountResult } from "@/lib/store-discount";

/**
 * Code resolution, deliberately kept OUT of a `"use server"` module.
 *
 * This used to be an exported function in src/lib/actions/creator-codes.ts.
 * Every export of a `"use server"` module is registered as a callable POST
 * endpoint, so it was reachable directly from the browser — with no session
 * check, no rate limit, and a return value carrying the whole `CreatorCode`
 * including `internalNote`, the admin-only free-text field. That bypassed both
 * controls `previewCreatorCode` deliberately puts in front of the same data:
 * its throttle, and its narrow whitelist of fields.
 *
 * The docblock below also states an invariant a server action cannot enforce —
 * "`lines` must come from the database, never from the browser" — which is only
 * true while this stays a plain server function that only server code can call.
 *
 * Resolves a code against already-priced cart lines. `lines` must come from the
 * database, never from the browser: the caller is responsible for having looked
 * every product up itself. This function only decides eligibility and arithmetic.
 */

export interface ResolvedCode {
  code: CreatorCode;
  result: DiscountResult;
}

export type ResolveOutcome =
  | { ok: true; resolved: ResolvedCode }
  | { ok: false; reason: "invalid" | "not_applicable" };

export async function resolveCreatorCode(
  rawCode: string,
  lines: Omit<DiscountInputLine, "eligible">[],
): Promise<ResolveOutcome> {
  const code = await getRedeemableCreatorCode(rawCode);
  if (!code) return { ok: false, reason: "invalid" };

  /*
    Sitewide eligibility is read from the stored flag, never inferred from an
    empty pick list.

    This briefly keyed off `productIds.length === 0` instead, which quietly
    promoted two kinds of row to a discount of up to 90% off the whole cart:
    codes saved with nothing picked — which the Store admin still describes as
    inert — and codes scoped to products that were later deleted, since
    creator_code_products.product_id cascades. Neither is a decision anyone
    made, and the code string is public by design.

    An empty list with the flag off still discounts nothing, and the guard
    below turns that into `not_applicable`.
  */
  const eligibleIds = new Set(code.productIds);
  const result = applyCreatorCode(
    lines.map((line) => ({
      ...line,
      eligible: code.appliesToAllProducts || eligibleIds.has(line.productId),
    })),
    code.percentOff,
  );

  // A real code that happens to discount nothing in this cart is not an invalid
  // code, and saying "invalid" would send the buyer off to re-type a correct one.
  if (result.discount <= 0) return { ok: false, reason: "not_applicable" };

  return { ok: true, resolved: { code, result } };
}
