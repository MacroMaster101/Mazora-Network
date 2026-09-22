import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { StoreOrder } from "@/lib/order-status";
import {
  invoiceLineTotal,
  type InvoiceLine,
  type InvoiceTotals,
} from "@/lib/invoice-math";
import type { InvoiceView } from "@/lib/invoice-view";
import type { StoreInvoiceDetails } from "@/lib/types";

/**
 * Invoice reads. Writes go through the validated server actions in
 * "@/lib/actions/order-invoices".
 *
 * An invoice comes in two kinds:
 *
 *   order-backed  `orderId` is set. Lines and money are read from the order, so
 *                 the document can never quote a figure the buyer was not
 *                 charged. Issued automatically when an order completes.
 *
 *   standalone    `orderId` is null. Staff built it by hand for a sale arranged
 *                 in Discord that never became an `orders` row, and the lines
 *                 live in `invoice_items` with their own per-line discounts.
 */

export interface OrderInvoice {
  id: string;
  /** Null on a standalone invoice. */
  orderId: string | null;
  invoiceNo: string;
  adjustment: number;
  notes: string | null;
  billedTo: string | null;
  buyerName: string | null;
  buyerDiscord: string | null;
  issuedAt: string;
  /** The staff member who raised it on the website. */
  issuedBy: string | null;
  /** Populated for standalone invoices only. */
  items: InvoiceLine[];
}

function toInvoice(
  row: typeof schema.orderInvoices.$inferSelect,
  items: InvoiceLine[] = [],
): OrderInvoice {
  return {
    id: row.id,
    orderId: row.orderId,
    invoiceNo: row.invoiceNo,
    adjustment: Number(row.adjustment ?? 0),
    notes: row.notes,
    billedTo: row.billedTo,
    buyerName: row.buyerName,
    buyerDiscord: row.buyerDiscord,
    issuedAt: row.issuedAt.toISOString(),
    issuedBy: row.issuedBy,
    items,
  };
}

function toLine(row: typeof schema.invoiceItems.$inferSelect): InvoiceLine {
  return {
    productId: row.productId,
    name: row.name,
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice ?? 0),
    discountPercent: row.discountPercent,
  };
}

/** Lines for the given invoices, grouped by invoice id in one query. */
async function loadItems(
  db: NonNullable<ReturnType<typeof getDb>>,
  invoiceIds: string[],
): Promise<Map<string, InvoiceLine[]>> {
  const grouped = new Map<string, InvoiceLine[]>();
  if (invoiceIds.length === 0) return grouped;
  const rows = await db
    .select()
    .from(schema.invoiceItems)
    .where(inArray(schema.invoiceItems.invoiceId, invoiceIds))
    .orderBy(asc(schema.invoiceItems.sortOrder));
  for (const row of rows) {
    const list = grouped.get(row.invoiceId) ?? [];
    list.push(toLine(row));
    grouped.set(row.invoiceId, list);
  }
  return grouped;
}

/** The order's invoice, or null when none has been issued. */
export async function getOrderInvoice(orderId: string): Promise<OrderInvoice | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select()
      .from(schema.orderInvoices)
      .where(eq(schema.orderInvoices.orderId, orderId))
      .limit(1);
    return row ? toInvoice(row) : null;
  } catch (error) {
    console.error("Failed to load order invoice:", error);
    return null;
  }
}

/** One invoice by its number, whichever kind it is. */
export async function getInvoiceByNumber(invoiceNo: string): Promise<OrderInvoice | null> {
  const db = getDb();
  if (!db || !invoiceNo) return null;
  try {
    const [row] = await db
      .select()
      .from(schema.orderInvoices)
      .where(eq(schema.orderInvoices.invoiceNo, invoiceNo))
      .limit(1);
    if (!row) return null;
    const items = await loadItems(db, [row.id]);
    return toInvoice(row, items.get(row.id) ?? []);
  } catch (error) {
    console.error("Failed to load invoice:", error);
    return null;
  }
}

/**
 * Order-backed invoices keyed by order id, for the Orders admin list.
 *
 * One query rather than one per row: the list renders every order, and asking
 * per order would fan out into N+1 queries as order volume grows.
 */
export async function getOrderInvoices(): Promise<Record<string, OrderInvoice>> {
  const db = getDb();
  if (!db) return {};
  try {
    const rows = await db.select().from(schema.orderInvoices);
    return Object.fromEntries(
      rows.flatMap((row) => (row.orderId ? [[row.orderId, toInvoice(row)] as const] : [])),
    );
  } catch (error) {
    console.error("Failed to load order invoices:", error);
    return {};
  }
}

/**
 * The lines to print, taken from whichever source owns them.
 *
 * An order's own items carry no per-line discount — the creator code discounts
 * the cart as a whole — so they come through at 0% and the code is shown on its
 * own totals row instead.
 */
function invoiceLines(invoice: OrderInvoice, order: StoreOrder | null): InvoiceLine[] {
  if (!invoice.orderId) return invoice.items;
  if (!order) return [];
  return order.items.map((item) => ({
    productId: null,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    discountPercent: 0,
  }));
}

/**
 * Recomputes every printed figure.
 *
 * Order-backed invoices take the subtotal and discount from the order, which is
 * the record of what was actually charged. Standalone invoices sum their own
 * lines, where the discount is the total of the per-line percentages.
 */
function invoiceTotals(
  invoice: OrderInvoice,
  order: StoreOrder | null,
  lines: InvoiceLine[],
): InvoiceTotals {
  const adjustment = round2(Number.isFinite(invoice.adjustment) ? invoice.adjustment : 0);

  if (invoice.orderId && order) {
    const subtotal = round2(order.subtotal);
    const discount = round2(order.discount);
    return { subtotal, discount, adjustment, total: round2(subtotal - discount + adjustment) };
  }

  let gross = 0;
  let net = 0;
  for (const line of lines) {
    gross += line.unitPrice * line.quantity;
    net += invoiceLineTotal(line);
  }
  const subtotal = round2(gross);
  const discount = round2(gross - net);
  return { subtotal, discount, adjustment, total: round2(subtotal - discount + adjustment) };
}

/** Money is compared and printed to the cent, never to a float's last bit. */
function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Resolves an invoice into the flat shape the sheet renders.
 *
 * The one place order lookup, line selection and totals come together, so the
 * page and the Orders popup cannot drift apart — and so the client is handed
 * finished figures rather than the pieces to compute them.
 */
export function buildInvoiceView(
  invoice: OrderInvoice | null,
  order: StoreOrder | null,
  details: StoreInvoiceDetails,
): InvoiceView {
  const resolved: OrderInvoice = invoice ?? {
    id: "",
    orderId: order?.id ?? null,
    invoiceNo: order?.reference ?? "",
    adjustment: 0,
    notes: null,
    billedTo: null,
    buyerName: null,
    buyerDiscord: null,
    issuedAt: order?.createdAt ?? new Date().toISOString(),
    issuedBy: null,
    items: [],
  };

  const lines = invoice
    ? invoiceLines(invoice, order)
    : (order?.items ?? []).map((item) => ({
        productId: null,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        discountPercent: 0,
      }));

  return {
    invoiceNo: resolved.invoiceNo || order?.reference || "—",
    issuedAt: resolved.issuedAt,
    billedTo:
      resolved.billedTo ||
      resolved.buyerName ||
      order?.minecraftUsername ||
      order?.discordUsername ||
      "—",
    buyerDiscord: resolved.buyerDiscord || order?.discordUsername || null,
    status: order?.status ?? "issued",
    issuedBy: resolved.issuedBy || order?.handledBy || "—",
    notes: resolved.notes || details.footerNote,
    lines,
    totals: invoiceTotals(resolved, order, lines),
    creatorCode: order?.creatorCode ?? null,
    details,
    issued: Boolean(invoice),
  };
}
