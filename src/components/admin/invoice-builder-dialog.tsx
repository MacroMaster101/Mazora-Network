"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Receipt, Search, Trash2 } from "lucide-react";
import type { Product } from "@/lib/types";
import { FormRow, Input, Modal, Textarea, useToast } from "@/components/ui";
import { invoiceLineTotal } from "@/lib/invoice-math";
import { usd } from "@/lib/utils";
import {
  createStandaloneInvoiceAction,
  type InvoiceActionResult,
} from "@/lib/actions/order-invoices";

/**
 * Builds an invoice for a sale that has no website order behind it.
 *
 * Most purchases are arranged in a Discord ticket and never become an `orders`
 * row, so staff pick the store items by hand here. Prices default to the
 * catalogue but stay editable, because a Discord deal is frequently not the
 * listed price, and the discount is per line since one rank is often reduced
 * while the crate keys beside it are not.
 */

interface Draft {
  key: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

const EMPTY: InvoiceActionResult = { ok: false };

let nextKey = 0;
const makeKey = () => `line-${nextKey++}`;

/** Today as "YYYY-MM-DD", matching the date input and the stored UTC date. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InvoiceBuilderDialog({
  products,
  onClose,
}: {
  products: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState(createStandaloneInvoiceAction, EMPTY);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerDiscord, setBuyerDiscord] = useState("");
  const [issuedAt, setIssuedAt] = useState(today());
  const [adjustment, setAdjustment] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Draft[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  function addProduct(product: Product) {
    setLines((current) => [
      ...current,
      {
        key: makeKey(),
        productId: product.id ?? null,
        name: product.name,
        // Sale price is what the buyer would pay on the site, so it is the
        // honest starting point when one is set.
        unitPrice: product.salePrice ?? product.price,
        quantity: 1,
        discountPercent: 0,
      },
    ]);
    setQuery("");
  }

  function addBlank() {
    setLines((current) => [
      ...current,
      { key: makeKey(), productId: null, name: "", quantity: 1, unitPrice: 0, discountPercent: 0 },
    ]);
  }

  function update(key: string, patch: Partial<Draft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const parsedAdjustment = Number(adjustment);
  const safeAdjustment = Number.isFinite(parsedAdjustment) ? parsedAdjustment : 0;
  const gross = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const net = lines.reduce((sum, line) => sum + invoiceLineTotal(line), 0);
  const total = net + safeAdjustment;

  return (
    <Modal open onClose={onClose} label="Create invoice" size="editor">
      <div className="store-admin-modal panel overflow-hidden">
        <form action={action}>
          {/* The lines travel as JSON: a variable-length list of objects does
              not survive flat FormData fields cleanly. */}
          <input type="hidden" name="items" value={JSON.stringify(lines.map(({ key: _key, ...rest }) => rest))} />

          {/* Right padding reserves the modal's own close button, matching the
              other Store admin editors. The panel carries no padding itself, so
              the header rule runs the full width. */}
          <header className="flex items-start gap-3 border-b border-line/60 py-5 pl-6 pr-[4.5rem]">
            <span className="mt-0.5 rounded-lg bg-accent/10 p-2 text-accent">
              <Receipt size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-extrabold text-ink">Create invoice</h2>
              <p className="mt-1 text-sm text-muted">
                For a sale arranged in Discord that has no website order.
              </p>
            </div>
          </header>

          <div className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Invoice #" htmlFor="b-no" error={state.errors?.invoiceNo}>
                <Input
                  id="b-no"
                  name="invoiceNo"
                  value={invoiceNo}
                  maxLength={60}
                  placeholder="INV-001"
                  onChange={(event) => setInvoiceNo(event.target.value)}
                />
              </FormRow>
              <FormRow label="Invoice date" htmlFor="b-date" error={state.errors?.issuedAt}>
                <Input
                  id="b-date"
                  name="issuedAt"
                  type="date"
                  value={issuedAt}
                  onChange={(event) => setIssuedAt(event.target.value)}
                />
              </FormRow>
              <FormRow label="Invoice for" htmlFor="b-buyer" error={state.errors?.buyerName}>
                <Input
                  id="b-buyer"
                  name="buyerName"
                  value={buyerName}
                  maxLength={120}
                  placeholder="Minecraft username"
                  onChange={(event) => setBuyerName(event.target.value)}
                />
              </FormRow>
              <FormRow label="Discord (optional)" htmlFor="b-dc" error={state.errors?.buyerDiscord}>
                <Input
                  id="b-dc"
                  name="buyerDiscord"
                  value={buyerDiscord}
                  maxLength={120}
                  placeholder="@username"
                  onChange={(event) => setBuyerDiscord(event.target.value)}
                />
              </FormRow>
            </div>

            {/* --- items ------------------------------------------------------ */}
            <section className="rounded-xl border border-line/60 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold text-ink">Items</h3>
                <span className="text-xs text-muted">{lines.length} on this invoice</span>
              </div>

              <div className="relative mt-3">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search store items to add"
                  aria-label="Search store items"
                  className="pl-10"
                />
              </div>

              {matches.length > 0 && (
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {matches.map((product) => (
                    <li key={product.id ?? product.slug}>
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line/60 bg-card px-3 py-2 text-left text-xs transition hover:border-accent/50 hover:bg-accent/5"
                      >
                        <span className="min-w-0 truncate text-ink">{product.name}</span>
                        <span className="shrink-0 font-semibold text-muted">
                          {usd(product.salePrice ?? product.price)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button type="button" onClick={addBlank} className="btn btn-ghost btn-sm mt-3">
                <Plus size={14} /> Add a custom line
              </button>

              {state.errors?.items && (
                <p className="mt-2 text-xs font-semibold text-danger">{state.errors.items}</p>
              )}
              {state.errors?.name && (
                <p className="mt-2 text-xs font-semibold text-danger">{state.errors.name}</p>
              )}

              {lines.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {lines.map((line) => (
                    <li
                      key={line.key}
                      className="grid items-end gap-2 rounded-lg border border-line/60 bg-ink/5 p-2.5 sm:grid-cols-[1fr_4.5rem_6rem_5.5rem_auto]"
                    >
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-muted">Item</span>
                        <Input
                          value={line.name}
                          maxLength={160}
                          placeholder="Description"
                          onChange={(event) => update(line.key, { name: event.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-muted">Qty</span>
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={line.quantity}
                          onChange={(event) =>
                            update(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-muted">Price</span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={line.unitPrice}
                          onChange={(event) =>
                            update(line.key, { unitPrice: Math.max(0, Number(event.target.value) || 0) })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-muted">Disc %</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={line.discountPercent}
                          onChange={(event) =>
                            update(line.key, {
                              discountPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                            })
                          }
                        />
                      </label>
                      <div className="flex items-center gap-2 pb-1.5">
                        <span className="min-w-[4.5rem] text-right text-sm font-bold text-ink">
                          {usd(invoiceLineTotal(line))}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
                          aria-label={`Remove ${line.name || "line"}`}
                          className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Adjustment" htmlFor="b-adj" error={state.errors?.adjustment}>
                <Input
                  id="b-adj"
                  name="adjustment"
                  type="number"
                  step="0.01"
                  value={adjustment}
                  onChange={(event) => setAdjustment(event.target.value)}
                />
                <p className="mt-1 text-xs text-muted">Negative for a credit.</p>
              </FormRow>
              <FormRow label="Notes (optional)" htmlFor="b-notes" error={state.errors?.notes}>
                <Textarea
                  id="b-notes"
                  name="notes"
                  rows={3}
                  value={notes}
                  maxLength={600}
                  placeholder="This rank is valid from … to …"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </FormRow>
            </div>

            <div className="rounded-xl border border-line/60 bg-ink/5 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold">{usd(gross)}</span>
              </div>
              {gross - net > 0 && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted">Discount</span>
                  <span className="font-semibold">−{usd(gross - net)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted">Adjustments</span>
                <span className="font-semibold">{usd(safeAdjustment)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-2">
                <span className="font-bold text-ink">Invoice total</span>
                <span className="font-display text-lg font-extrabold text-accent">{usd(total)}</span>
              </div>
            </div>

            {state.message && !state.ok && (
              <p className="text-sm font-semibold text-danger">{state.message}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={pending} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || lines.length === 0}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                {pending ? "Creating…" : "Create invoice"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
