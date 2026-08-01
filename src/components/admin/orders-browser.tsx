"use client";

import { useMemo, useState } from "react";
import { Receipt, Search } from "lucide-react";
import type { OrderStatus, StoreOrder } from "@/lib/order-status";
import { OrderCard } from "@/components/shared/order-card";
import { Input } from "@/components/ui";
import { cn, usd } from "@/lib/utils";

/**
 * Staff order list. Read-only by design: orders are actioned with the
 * Confirm/Reject buttons on the Discord message, so there is exactly one place
 * a decision can be made and the two views can never disagree.
 */

type Filter = "all" | OrderStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Awaiting review" },
  { key: "confirmed", label: "Confirmed" },
  { key: "awaiting_discord_join", label: "Awaiting join" },
  { key: "rejected", label: "Declined" },
];

export function OrdersBrowser({ orders }: { orders: StoreOrder[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

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

  return (
    <div className="space-y-5">
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
            <OrderCard key={order.id} order={order} showBuyer />
          ))}
        </div>
      )}
    </div>
  );
}
