/**
 * Invoice line shapes and money arithmetic, shared by the server and the
 * builder UI.
 *
 * Here rather than beside the reader in lib/data/order-invoices, which is
 * `server-only` and pulls in the postgres driver: the invoice builder is a
 * Client Component and needs the same arithmetic to show a live total, so
 * importing from there would drag the driver into the browser bundle. This is
 * the same reason lib/types holds the store's other shared constants.
 */

export interface InvoiceLine {
  /** Null once the product is deleted, or for a free-text line. */
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  /** 0–100, applied to this line only. */
  discountPercent: number;
}

export interface InvoiceTotals {
  /** Sum of the lines before any discount. */
  subtotal: number;
  /** Total discount, printed as a negative row. */
  discount: number;
  /** Staff-entered adjustment, signed. */
  adjustment: number;
  /** subtotal − discount + adjustment. */
  total: number;
}

/** A line's charge after its own discount, exact to the cent. */
export function invoiceLineTotal(line: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}): number {
  const quantity = Math.max(0, Math.trunc(Number(line.quantity) || 0));
  const unitPrice = Number(line.unitPrice) || 0;
  const percent = Math.min(100, Math.max(0, Number(line.discountPercent) || 0));
  /*
    Rounded in cents rather than multiplied as floats. 3 × $19.99 at 15% off is
    50.9745 in floating point, which prints as $50.97 but sums against other
    lines as something slightly different — and an invoice whose lines do not
    add up to its total is the one rounding error a buyer will notice.
  */
  const cents = Math.round(quantity * unitPrice * 100);
  return Math.round(cents * (1 - percent / 100)) / 100;
}
