"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import type { Product } from "@/lib/types";
import { InvoiceBuilderDialog } from "@/components/admin/invoice-builder-dialog";

/**
 * Sits in the Orders header's action slot, ahead of the refresh button.
 *
 * Separate from OrdersBrowser because DashHeader is rendered by the page and
 * takes its action as a node — this keeps the builder's open state next to the
 * button that opens it rather than threading it through the order list, which
 * no longer has anything to do with creating invoices.
 */
export function CreateInvoiceButton({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
        <Receipt size={15} /> Create invoice
      </button>
      {open && <InvoiceBuilderDialog products={products} onClose={() => setOpen(false)} />}
    </>
  );
}
