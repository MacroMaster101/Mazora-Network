"use client";

import { ExternalLink, Printer } from "lucide-react";
import type { InvoiceView } from "@/lib/invoice-view";
import { Modal } from "@/components/ui";
import { InvoiceSheet } from "@/components/shared/invoice-sheet";
import "@/styles/invoice.css";

/**
 * Shows an order's invoice without leaving the Orders list.
 *
 * Printing works from here unchanged: the `@media print` block in invoice.css
 * hides everything except `.invoice-sheet`, and the sheet is in the document
 * whether it sits on its own page or inside this modal.
 */
export function InvoicePreviewDialog({
  view,
  reference,
  onClose,
}: {
  view: InvoiceView;
  /** Order reference, for the full-page link. */
  reference: string;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} label={`Invoice ${view.invoiceNo}`} size="editor">
      <div className="invoice-dialog panel overflow-hidden">
        {/* Right padding reserves the modal's own close button. */}
        <header
          className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 py-4 pl-6 pr-[4.5rem]"
          data-no-print
        >
          <div>
            <h2 className="font-display text-base font-extrabold text-ink">
              Invoice {view.invoiceNo}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{view.billedTo}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/admin/orders/${encodeURIComponent(reference)}/invoice`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <ExternalLink size={14} /> Open page
            </a>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => window.print()}
            >
              <Printer size={14} /> Download / Print
            </button>
          </div>
        </header>

        <div className="invoice-dialog-body">
          <InvoiceSheet view={view} />
        </div>
      </div>
    </Modal>
  );
}
