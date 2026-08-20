"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, CircleDollarSign, Clock3, Receipt, Search, ShoppingBag, Trash2, TriangleAlert, X } from "lucide-react";
import type { OrderStatus, StoreOrder } from "@/lib/order-status";
import { OrderCard } from "@/components/shared/order-card";
import { Input, useToast } from "@/components/ui";
import { cn, usd } from "@/lib/utils";
import { deleteOrderAction, updateOrderDecisionAction } from "@/lib/actions/orders-admin";

/**
 * Staff order list and guarded web decision controls. Discord remains the
 * place for ticket/DM operations; these controls update the durable order
 * record and audit trail directly.
 */

type Filter = "all" | OrderStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Awaiting review" },
  { key: "confirmed", label: "In progress" },
  { key: "awaiting_discord_join", label: "Awaiting join" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Declined" },
];

type Confirmation = { type: "decline" | "delete"; order: StoreOrder } | null;

export function OrdersBrowser({ orders, canDelete }: { orders: StoreOrder[]; canDelete: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [typedReference, setTypedReference] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!confirmation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setConfirmation(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [confirmation, pending]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: orders.length };
    for (const order of orders) map[order.status] = (map[order.status] ?? 0) + 1;
    return map;
  }, [orders]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) return false;
      if (!needle) return true;
      return (
        order.reference.toLowerCase().includes(needle) ||
        (order.minecraftUsername ?? "").toLowerCase().includes(needle) ||
        (order.discordUsername ?? "").toLowerCase().includes(needle) ||
        order.items.some((item) => item.name.toLowerCase().includes(needle))
      );
    });
  }, [orders, filter, query]);

  // Declined orders are excluded: staff never collect on them, so including
  // them would overstate what the store actually took.
  const outstanding = useMemo(
    () => visible.filter((order) => order.status !== "rejected").reduce((sum, order) => sum + order.total, 0),
    [visible],
  );

  const summary = useMemo(() => {
    const accepted = orders.filter((order) => order.status === "confirmed" || order.status === "completed");
    const completed = orders.filter((order) => order.status === "completed");
    return {
      total: orders.length,
      awaiting: orders.filter((order) => order.status === "pending" || order.status === "awaiting_discord_join").length,
      acceptedValue: accepted.reduce((sum, order) => sum + order.total, 0),
      completedSales: completed.reduce((sum, order) => sum + order.total, 0),
    };
  }, [orders]);

  function finish(result: { ok: boolean; message: string }) {
    toast(result.message, result.ok ? "success" : "error");
    if (result.ok) {
      setConfirmation(null);
      setTypedReference("");
      router.refresh();
    }
  }

  function accept(order: StoreOrder) {
    startTransition(async () => finish(await updateOrderDecisionAction(order.id, "confirmed")));
  }

  function confirmAction() {
    if (!confirmation) return;
    startTransition(async () => {
      const result = confirmation.type === "decline"
        ? await updateOrderDecisionAction(confirmation.order.id, "rejected")
        : await deleteOrderAction(confirmation.order.id, typedReference);
      finish(result);
    });
  }

  function openConfirmation(type: "decline" | "delete", order: StoreOrder) {
    setTypedReference("");
    setConfirmation({ type, order });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Order summary">
        {[
          { label: "Total orders", value: String(summary.total), note: "All recorded requests", icon: ShoppingBag, tone: "text-accent-bright bg-accent/12 border-accent/25" },
          { label: "Awaiting review", value: String(summary.awaiting), note: "Needs a staff decision", icon: Clock3, tone: "text-warning bg-warning/10 border-warning/25" },
          { label: "Accepted value", value: usd(summary.acceptedValue), note: "In progress + completed", icon: Receipt, tone: "text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/25" },
          { label: "Completed sales", value: usd(summary.completedSales), note: "Delivered orders only", icon: CircleDollarSign, tone: "text-success bg-success/10 border-success/25" },
        ].map((card) => (
          <article key={card.label} className="panel flex min-w-0 items-center gap-4 p-4 sm:p-5">
            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", card.tone)}>
              <card.icon size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wide text-muted">{card.label}</span>
              <strong className="telemetry mt-1 block truncate text-xl font-black text-ink">{card.value}</strong>
              <span className="mt-0.5 block text-xs text-muted">{card.note}</span>
            </span>
          </article>
        ))}
      </section>

      {/* One solid surface: these controls sit over the world artwork, and
          floating them directly on it left the labels hard to read. */}
      <div className="panel space-y-4 p-4 sm:p-5">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reference, Minecraft name, Discord name or item"
            aria-label="Search orders"
            className="pl-10"
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter orders by status"
        >
          {FILTERS.map((entry) => {
            const active = filter === entry.key;
            const count = counts[entry.key] ?? 0;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setFilter(entry.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
                  active
                    ? "border-accent/60 bg-accent/20 text-accent-bright shadow-[0_0_0_1px_rgb(var(--accent)/0.25)]"
                    : "border-line bg-ink/5 text-muted hover:border-line-strong hover:bg-ink/10 hover:text-ink",
                )}
              >
                {entry.label}
                {/* 10px was too small to tell 9 from 0 at a glance. */}
                <span
                  className={cn(
                    "grid min-w-[1.4rem] place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none tabular-nums",
                    active ? "bg-accent/30 text-accent-bright" : "bg-ink/15 text-ink/80",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-sm">
          <span className="text-muted">
            Showing <strong className="text-ink">{visible.length}</strong> of {orders.length}
          </span>
          <span className="text-muted">
            Value excluding declined: <strong className="telemetry text-ink">{usd(outstanding)}</strong>
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel grid place-items-center gap-2 p-10 text-center">
          <Receipt size={24} className="text-muted" />
          <p className="font-semibold">No orders match</p>
          <p className="text-sm text-muted">
            {orders.length === 0
              ? "Order requests sent from the store will appear here."
              : "Try a different status or search term."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showBuyer
              actions={(
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-relaxed text-muted">
                    Web decisions update the order record. Handle Discord tickets or buyer messages separately.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {(order.status === "pending" || order.status === "awaiting_discord_join") && (
                      <button
                        type="button"
                        onClick={() => accept(order)}
                        disabled={pending}
                        aria-label={`Accept ${order.reference}`}
                        className="btn btn-sm border-success/35 bg-success/10 text-success hover:bg-success/20 disabled:opacity-50"
                      >
                        <Check size={15} /> Accept
                      </button>
                    )}
                    {(order.status === "pending" || order.status === "awaiting_discord_join" || order.status === "confirmed") && (
                      <button
                        type="button"
                        onClick={() => openConfirmation("decline", order)}
                        disabled={pending}
                        aria-label={`Decline ${order.reference}`}
                        className="btn btn-sm border-danger/35 bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50"
                      >
                        <X size={15} /> Decline
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => openConfirmation("delete", order)}
                        disabled={pending}
                        aria-label={`Delete ${order.reference}`}
                        className="btn btn-sm border-danger/25 bg-transparent text-muted hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            />
          ))}
        </div>
      )}

      {confirmation && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-confirm-title"
          onClick={() => !pending && setConfirmation(null)}
        >
          <div className="flex min-h-full items-center justify-center">
            <div className="my-auto w-full max-w-md" onClick={(event) => event.stopPropagation()}>
              <div className="panel max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
                      <TriangleAlert size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id="order-confirm-title" className="font-display text-lg font-extrabold text-ink">
                        {confirmation.type === "delete" ? "Permanently delete order?" : "Decline this order?"}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {confirmation.order.reference} · {usd(confirmation.order.total)}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setConfirmation(null)} disabled={pending} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                {confirmation.type === "delete" ? (
                  <div className="mt-5 space-y-3">
                    <p className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-sm leading-relaxed text-muted">
                      This permanently removes the order and all line items. Sales totals will be recalculated. This cannot be undone.
                    </p>
                    <label htmlFor="confirm-order-reference" className="block text-xs font-bold text-ink">
                      Type <strong>{confirmation.order.reference}</strong> to confirm
                    </label>
                    <Input
                      id="confirm-order-reference"
                      value={typedReference}
                      onChange={(event) => setTypedReference(event.target.value)}
                      autoComplete="off"
                      placeholder={confirmation.order.reference}
                    />
                  </div>
                ) : (
                  <p className="mt-5 rounded-xl border border-danger/25 bg-danger/5 p-3 text-sm leading-relaxed text-muted">
                    The order will be marked declined. This web action does not automatically close a Discord ticket or message the buyer.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setConfirmation(null)} disabled={pending} className="btn btn-ghost btn-sm">Cancel</button>
                  <button
                    type="button"
                    onClick={confirmAction}
                    disabled={pending || (confirmation.type === "delete" && typedReference !== confirmation.order.reference)}
                    className="btn btn-sm border-danger/40 bg-danger/15 text-danger hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {confirmation.type === "delete" ? <Trash2 size={14} /> : <X size={14} />}
                    {pending ? "Working…" : confirmation.type === "delete" ? "Delete order" : "Decline order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
