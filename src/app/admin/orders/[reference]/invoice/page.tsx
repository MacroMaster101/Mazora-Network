import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ORDERS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAllOrders } from "@/lib/data/orders";
import {
  buildInvoiceView,
  getInvoiceByNumber,
  getOrderInvoice,
} from "@/lib/data/order-invoices";
import { getStoreInvoiceDetails } from "@/lib/data/store-settings";
import { BackLink } from "@/components/shared";
import { InvoiceSheet } from "@/components/shared/invoice-sheet";
import { InvoicePrintButton } from "@/components/admin/invoice-print-button";
import "@/styles/invoice.css";

export const metadata: Metadata = { title: "Invoice · Admin" };

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  await requireModuleAccess(ORDERS_PERMISSION_KEY, `/admin/orders/${reference}/invoice`);

  /*
    The route segment is an order reference for an order-backed invoice and an
    invoice number for a standalone one. Orders are looked up first because
    their references are what staff already have in front of them.
  */
  const decoded = decodeURIComponent(reference);
  const order = (await getAllOrders()).find((o) => o.reference === decoded) ?? null;

  const [invoice, details] = await Promise.all([
    order ? getOrderInvoice(order.id) : getInvoiceByNumber(decoded),
    getStoreInvoiceDetails(),
  ]);

  if (!order && !invoice) notFound();

  const view = buildInvoiceView(invoice, order, details);

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar" data-no-print>
        <BackLink href="/admin/orders" label="Back to Orders" />
        <div className="invoice-toolbar-actions">
          {!view.issued && <span className="invoice-draft-pill">Preview · not yet issued</span>}
          <InvoicePrintButton />
        </div>
      </div>

      <InvoiceSheet view={view} />
    </div>
  );
}
