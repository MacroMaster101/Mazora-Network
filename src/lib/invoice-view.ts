import type { InvoiceLine, InvoiceTotals } from "@/lib/invoice-math";
import type { StoreInvoiceDetails } from "@/lib/types";

/**
 * Everything the printed sheet renders, already resolved.
 *
 * The sheet is shown in two places — its own page and a popup on the Orders
 * list — and the popup is a Client Component, so this shape has to cross the
 * server boundary. Resolving it on the server keeps the money arithmetic and
 * the order lookup out of the browser entirely: the client receives figures,
 * never the means to compute them.
 */
export interface InvoiceView {
  invoiceNo: string;
  /** ISO; the sheet formats it. */
  issuedAt: string;
  billedTo: string;
  buyerDiscord: string | null;
  status: string;
  issuedBy: string;
  notes: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  /** Named on the discount row when the order used a creator code. */
  creatorCode: string | null;
  details: StoreInvoiceDetails;
  /** False while previewing an order that has no invoice issued yet. */
  issued: boolean;
}
