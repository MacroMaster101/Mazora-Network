"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { usd } from "@/lib/utils";
import { coverGradient } from "./accent";
import { OrderRequestForm } from "./order-request-form";

export function CartView({ requestsConfigured }: { requestsConfigured: boolean }) {
  const { items, total, setQty, remove, clear, ready, count } = useCart();

  if (!ready) {
    return <div className="skeleton h-40 w-full rounded-2xl" />;
  }

  if (count === 0) {
    return (
      <div className="glass flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-xl border border-line-strong bg-ink/5 text-muted">
          <ShoppingCart size={24} />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold">Your cart is empty</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">Browse Survival ranks, crate keys, battlepass upgrades and add-ons.</p>
        <Link href="/store" className="btn btn-primary mt-6">
          Browse the store
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.slug} className="panel flex items-center gap-4 p-4">
            <span
              className="h-14 w-14 shrink-0 rounded-lg border border-line"
              style={{ backgroundImage: coverGradient(item.accent) }}
            />
            <div className="min-w-0 flex-1">
              <Link href={`/store/${item.slug}`} className="font-semibold hover:text-accent-bright">
                {item.name}
              </Link>
              <p className="telemetry text-sm text-muted">{usd(item.price)} each</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setQty(item.slug, item.qty - 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-muted hover:text-ink"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="telemetry w-8 text-center font-semibold">{item.qty}</span>
              <button
                onClick={() => setQty(item.slug, item.qty + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-muted hover:text-ink"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="telemetry w-20 text-right font-semibold">{usd(item.price * item.qty)}</span>
            <button
              onClick={() => remove(item.slug)}
              className="text-muted hover:text-danger"
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={clear} className="text-sm text-muted hover:text-danger">
          Clear cart
        </button>
      </div>

      <div className="glass h-fit p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-lg font-bold">Order summary</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal ({count} items)</span>
            <span className="telemetry text-ink">{usd(total)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Processing</span>
            <span className="telemetry">—</span>
          </div>
        </div>
        <div className="mt-4 flex justify-between border-t border-line pt-4">
          <span className="font-semibold">Total</span>
          <span className="telemetry text-lg font-bold">{usd(total)}</span>
        </div>
        <OrderRequestForm configured={requestsConfigured} />
      </div>
    </div>
  );
}
