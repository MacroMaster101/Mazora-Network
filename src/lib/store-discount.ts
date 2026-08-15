/**
 * Creator-code pricing. Pure on purpose: no database, no session, no I/O — so
 * the checkout preview and the order submission can share one implementation
 * and it can be unit-tested directly.
 *
 * All arithmetic happens in integer cents. Money in floating point accumulates
 * error that eventually shows up as a total that is one cent off what the line
 * items add up to, which is exactly the kind of thing a buyer screenshots.
 */

/** Above this, a deep discount starts producing free orders. */
export const MAX_PERCENT_OFF = 90;

export interface DiscountInputLine {
  productId: string;
  name: string;
  quantity: number;
  /** Already resolved to `salePrice ?? price` by the caller. */
  unitPrice: number;
  /** Whether this product is on the code's hand-picked eligibility list. */
  eligible: boolean;
}

export interface DiscountLine extends DiscountInputLine {
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
}

export interface DiscountResult {
  lines: DiscountLine[];
  subtotal: number;
  discount: number;
  total: number;
}

const toCents = (value: number): number => Math.round(value * 100);
const toMoney = (cents: number): number => cents / 100;

/**
 * Applies `percentOff` to eligible lines only.
 *
 * Rounding is half-up **per line**, then summed — so the per-line discounts a
 * buyer sees always add up to the order discount shown. Computing the order
 * discount first and apportioning it back across lines does not have that
 * property, and the mismatch surfaces as an off-by-a-cent line.
 */
export function applyCreatorCode(
  lines: DiscountInputLine[],
  percentOff: number,
): DiscountResult {
  const percent = Math.min(Math.max(Math.trunc(percentOff), 0), MAX_PERCENT_OFF);

  let subtotalCents = 0;
  let discountCents = 0;

  const priced = lines.map((line) => {
    // Guard against non-finite or non-integer quantities: a single malformed
    // database row must not poison the entire order's totals with NaN.
    const quantity = Number.isFinite(line.quantity) ? Math.max(Math.trunc(line.quantity), 0) : 0;
    // Clamped at zero as well as guarded for finiteness: Number.isFinite(-5) is
    // true, and a negative unit price would subtract from the order subtotal.
    const unitPrice = Number.isFinite(line.unitPrice) ? Math.max(line.unitPrice, 0) : 0;

    const lineSubtotalCents = toCents(unitPrice) * quantity;
    const lineDiscountCents =
      line.eligible && percent > 0
        ? Math.round((lineSubtotalCents * percent) / 100)
        : 0;

    subtotalCents += lineSubtotalCents;
    discountCents += lineDiscountCents;

    return {
      ...line,
      /*
        The sanitised values are carried out, not just used internally. Spreading
        `...line` alone put the raw ones back over them, so a line arriving with
        `quantity: NaN` came back with `lineSubtotal: 0` and `quantity: NaN`
        still attached — and any UI rendering "quantity x unitPrice" beside the
        total showed NaN next to $0.00. The tests only assert on `lineSubtotal`,
        so nothing caught it.
      */
      quantity,
      unitPrice,
      lineSubtotal: toMoney(lineSubtotalCents),
      lineDiscount: toMoney(lineDiscountCents),
      lineTotal: toMoney(lineSubtotalCents - lineDiscountCents),
    };
  });

  return {
    lines: priced,
    subtotal: toMoney(subtotalCents),
    discount: toMoney(discountCents),
    total: toMoney(subtotalCents - discountCents),
  };
}
