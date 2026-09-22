import Image from "next/image";
import type { InvoiceView } from "@/lib/invoice-view";
import { invoiceLineTotal } from "@/lib/invoice-math";
import { usd } from "@/lib/utils";

/**
 * The printed invoice document.
 *
 * Shared by the invoice page and the popup on the Orders list so the two can
 * never drift. Purely presentational — every figure arrives already resolved,
 * so this renders the same whether it is on a page, in a modal, or on paper.
 *
 * Styling lives in styles/invoice.css, which every caller must import.
 */

/** "02/11/2024", matching the day/month/year format on the previous invoices. */
function invoiceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function InvoiceSheet({ view }: { view: InvoiceView }) {
  const { details, lines, totals } = view;

  // Only shown when a line actually carries one, so an ordinary invoice keeps
  // the four columns of the printed original.
  const hasLineDiscounts = lines.some((line) => line.discountPercent > 0);

  const websiteHref = details.website
    ? details.website.startsWith("http")
      ? details.website
      : `https://${details.website}`
    : null;

  return (
    <article className="invoice-sheet">
      <div className="invoice-rule" aria-hidden="true" />

      <header className="invoice-head">
        <div>
          <h1 className="invoice-brand">{details.businessName}</h1>
          {websiteHref ? (
            <a className="invoice-site" href={websiteHref}>
              {details.website}
            </a>
          ) : null}
          {details.addressLines.map((line) => (
            <p key={line} className="invoice-addr">
              {line}
            </p>
          ))}
          {details.postcode ? <p className="invoice-addr">{details.postcode}</p> : null}
        </div>
        <Image
          src="/images/mazora-icon.png"
          alt=""
          width={150}
          height={150}
          className="invoice-logo"
          priority
        />
      </header>

      <h2 className="invoice-title">Invoice</h2>
      <p className="invoice-submitted">Submitted on {invoiceDate(view.issuedAt)}</p>

      <dl className="invoice-meta">
        <div>
          <dt>Invoice for</dt>
          <dd>{view.billedTo}</dd>
        </div>
        <div>
          <dt>Discord</dt>
          <dd>{view.buyerDiscord ?? "—"}</dd>
        </div>
        <div>
          <dt>Invoice #</dt>
          <dd>{view.invoiceNo}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{view.status}</dd>
        </div>
        <div>
          <dt>Issued By</dt>
          <dd>{view.issuedBy}</dd>
        </div>
      </dl>

      <table className="invoice-table">
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col" className="num">Qty</th>
            <th scope="col" className="num">Unit price</th>
            {hasLineDiscounts && <th scope="col" className="num">Discount</th>}
            <th scope="col" className="num">Total price</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.name}-${index}`}>
              <td>{line.name}</td>
              <td className="num">{line.quantity}</td>
              <td className="num">{usd(line.unitPrice)}</td>
              {hasLineDiscounts && (
                <td className="num">{line.discountPercent > 0 ? `${line.discountPercent}%` : "—"}</td>
              )}
              <td className="num">{usd(invoiceLineTotal(line))}</td>
            </tr>
          ))}
          {/* Keeps the ruled block the same height as the reference layout. */}
          <tr className="invoice-spacer">
            <td colSpan={hasLineDiscounts ? 5 : 4} />
          </tr>
        </tbody>
      </table>

      <div className="invoice-foot">
        <p className="invoice-notes">{view.notes ? `Notes: ${view.notes}` : ""}</p>
        <dl className="invoice-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{usd(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 ? (
            <div>
              <dt>Discount{view.creatorCode ? ` (${view.creatorCode})` : ""}</dt>
              <dd>−{usd(totals.discount)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Adjustments</dt>
            <dd>{usd(totals.adjustment)}</dd>
          </div>
          <div className="invoice-grand">
            <dt>Total</dt>
            <dd>{usd(totals.total)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
