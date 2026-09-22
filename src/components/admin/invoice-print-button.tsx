"use client";

import { Printer } from "lucide-react";

/**
 * Download is the browser's own print dialog with "Save as PDF" selected.
 *
 * No PDF library: the sheet is already laid out in CSS with an `@media print`
 * block, and every browser can render that to PDF. Generating one server-side
 * would mean shipping a headless renderer to reproduce a layout that already
 * prints correctly.
 */
export function InvoicePrintButton() {
  return (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
      <Printer size={14} aria-hidden="true" /> Download / Print
    </button>
  );
}
