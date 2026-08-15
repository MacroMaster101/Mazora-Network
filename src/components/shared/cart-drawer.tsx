"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import type { CreatorCodePreviewResult } from "@/lib/actions/creator-codes";
import { usd } from "@/lib/utils";
import { storeArtFor } from "@/lib/store-art";
import { useCart } from "./cart-provider";
import { OrderRequestForm } from "./order-request-form";
import { CreatorCodeField } from "./creator-code-field";
import { StoreArtwork } from "./store-artwork";

/** Slide-out duration; mirrors .cart-drawer-layer .cart-drawer in globals.css. */
const CLOSE_MS = 320;

export function CartDrawer({ requestsConfigured }: { requestsConfigured: boolean }) {
  const {
    isOpen,
    consumeOpenStep,
    closeCart,
    items,
    count,
    total,
    setQty,
    remove,
    ready,
  } = useCart();
  const [step, setStep] = useState<"cart" | "details">("cart");
  const [appliedCode, setAppliedCode] = useState<CreatorCodePreviewResult | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const isStoreRoute = pathname.startsWith("/store");

  // A cart edit invalidates the quoted discount, so the code is dropped rather
  // than left quoting a total that no longer matches the items.
  useEffect(() => {
    setAppliedCode(null);
  }, [items]);

  const discount = appliedCode?.ok ? appliedCode.discount ?? 0 : 0;

  /*
    Cart line prices are snapshotted into localStorage when an item is added, so
    they go stale if a product is repriced afterwards. The preview action prices
    the same cart from the database, so once a code is applied its subtotal and
    total are the authoritative pair — mixing the stale client subtotal with a
    server-computed discount would display a total that is simply wrong.
  */
  const shownSubtotal = appliedCode?.ok ? appliedCode.subtotal ?? total : total;
  const shownTotal = appliedCode?.ok ? appliedCode.total ?? total - discount : total;

  /*
    Replaces <AnimatePresence>. `mounted` keeps the drawer in the tree while it
    slides back out; `shown` is the flag the CSS transitions against and has to
    flip on a later frame than the mount, or the browser has no previous value
    to animate from and the drawer just appears.

    CLOSE_MS must stay in step with the transition duration on
    .cart-drawer-layer in globals.css.
  */
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }

    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // The provider can request the drawer to open straight on the details step
  // (used when returning from the Discord OAuth hop). The requested step is
  // consumed once the cart has loaded, since an empty cart has no details step.
  useEffect(() => {
    if (!isOpen || !ready) return;
    if (consumeOpenStep() === "details" && count > 0) setStep("details");
  }, [isOpen, ready, count, consumeOpenStep]);

  useEffect(() => {
    if (!isOpen) {
      setStep("cart");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeCart();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closeCart]);


  useEffect(() => {
    if (!isStoreRoute && isOpen) closeCart();
  }, [isStoreRoute, isOpen, closeCart]);

  if (!isStoreRoute || !mounted) return null;
  return (
    <div className="cart-drawer-layer fixed inset-0 z-[220]" data-open={shown ? "true" : "false"}>
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#07040d]/75 backdrop-blur-sm"
        onClick={closeCart}
        aria-label="Close cart"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="cart-drawer absolute inset-y-0 right-0 flex w-full max-w-[32rem] flex-col overflow-hidden"
      >
            <div className="cart-drawer-head relative overflow-hidden px-5 py-5 sm:px-7">
              <div className="cart-drawer-glow absolute -right-20 -top-24 h-56 w-56 rounded-full blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="cart-kicker telemetry text-[10px] font-bold uppercase tracking-[0.22em]">
                    Mazora marketplace
                  </p>
                  <h2 id="cart-drawer-title" className="mt-1 flex items-center gap-2 text-xl font-extrabold">
                    <ShoppingCart size={20} className="cart-accent" />
                    {step === "cart" ? "Your cart" : "Request details"}
                  </h2>
                  <p className="cart-muted mt-1 text-xs">
                    {step === "cart"
                      ? `${count} ${count === 1 ? "item" : "items"} ready to review`
                      : "Tell staff where to deliver your order."}
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeCart}
                  className="cart-icon-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl transition"
                  aria-label="Close cart"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="cart-step is-active flex items-center gap-2 text-xs font-semibold">
                  <span className="cart-step-dot grid h-6 w-6 place-items-center rounded-full text-[10px]">
                    {step === "details" ? <Check size={12} /> : "1"}
                  </span>
                  Review
                </div>
                <span className="cart-step-line h-px w-12" />
                <div className={`cart-step flex items-center justify-end gap-2 text-xs font-semibold ${step === "details" ? "is-active" : ""}`}>
                  <span className="cart-step-dot grid h-6 w-6 place-items-center rounded-full text-[10px]">
                    2
                  </span>
                  Request
                </div>
              </div>
            </div>

            {!ready ? (
              <div className="flex-1 space-y-3 p-6">
                <div className="cart-skeleton h-24 animate-pulse rounded-2xl" />
                <div className="cart-skeleton h-24 animate-pulse rounded-2xl" />
              </div>
            ) : count === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-7 text-center">
                <span className="cart-empty-icon grid h-20 w-20 place-items-center rounded-3xl">
                  <ShoppingCart size={30} />
                </span>
                <h3 className="mt-5 text-xl font-bold">Your cart is waiting</h3>
                <p className="cart-muted mt-2 max-w-xs text-sm leading-relaxed">
                  Explore ranks, crate keys and cosmetics created for the Mazora network.
                </p>
                <Link href="/store" onClick={closeCart} className="btn btn-primary mt-6">
                  Browse the store
                </Link>
              </div>
            ) : step === "cart" ? (
              <>
                <div className="store-drawer-scroll flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-7">
                  {items.map((item) => (
                    <div
                      key={item.slug}
                      className="cart-item group grid grid-cols-[5.25rem_minmax(0,1fr)_auto] gap-3 rounded-2xl p-3 transition"
                    >
                      <Link
                        href={`/store/${item.slug}`}
                        onClick={closeCart}
                        className="cart-item-art relative aspect-square overflow-hidden rounded-xl"
                      >
                        <StoreArtwork
                          src={storeArtFor(item)}
                          alt=""
                          sizes="84px"
                          imageClassName="transition duration-300 group-hover:scale-105"
                        />
                      </Link>
                      <div className="min-w-0 py-0.5">
                        <Link
                          href={`/store/${item.slug}`}
                          onClick={closeCart}
                          className="cart-item-name line-clamp-1 text-sm font-bold transition"
                        >
                          {item.name}
                        </Link>
                        <p className="cart-accent telemetry mt-1 text-xs">{usd(item.price)}</p>
                        <div className="cart-qty mt-3 flex w-fit items-center rounded-lg">
                          <button
                            type="button"
                            onClick={() => setQty(item.slug, item.qty - 1)}
                            className="cart-qty-btn grid h-7 w-7 place-items-center transition"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="telemetry w-7 text-center text-xs font-bold">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(item.slug, item.qty + 1)}
                            className="cart-qty-btn grid h-7 w-7 place-items-center transition"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between py-0.5">
                        <button
                          type="button"
                          onClick={() => remove(item.slug)}
                          className="cart-remove grid h-7 w-7 place-items-center rounded-lg transition"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                        <span className="telemetry text-sm font-bold">{usd(item.price * item.qty)}</span>
                      </div>
                    </div>
                  ))}

                  <div className="cart-assurance flex items-start gap-3 rounded-2xl p-4">
                    <ShieldCheck size={18} className="cart-assurance-ico mt-0.5 shrink-0" />
                    <p className="cart-muted text-xs leading-relaxed">
                      No payment is taken here. Staff receives your request privately and confirms the next step with you.
                    </p>
                  </div>
                </div>

                <div className="cart-foot px-5 py-5 sm:px-7">
                  <div className="mb-4">
                    <CreatorCodeField
                      items={items}
                      appliedCode={appliedCode}
                      onApplyCode={setAppliedCode}
                    />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="cart-muted text-xs">Estimated total</p>
                      <p className="cart-muted-2 mt-0.5 text-[11px]">Manual payment · no charge today</p>
                    </div>
                    <p className="flex items-baseline gap-2">
                      {discount > 0 && (
                        <span className="cart-muted-2 telemetry text-sm line-through">{usd(shownSubtotal)}</span>
                      )}
                      <span className="telemetry text-2xl font-black">{usd(shownTotal)}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => setStep("details")} className="btn btn-primary mt-4 w-full">
                    Continue to request
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="cart-link-muted mt-3 w-full text-center text-xs font-semibold transition"
                  >
                    Continue shopping
                  </button>
                </div>
              </>
            ) : (
              <div className="store-drawer-scroll flex-1 overflow-y-auto px-5 pb-8 sm:px-7">
                <button
                  type="button"
                  onClick={() => setStep("cart")}
                  className="cart-back-btn mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition"
                >
                  <ArrowLeft size={14} /> Back to cart
                </button>

                <section className="cart-summary mt-4 overflow-hidden rounded-2xl" aria-label="Order summary">
                  <div className="flex items-center justify-between px-4 pt-3.5">
                    <p className="cart-muted text-[10px] font-bold uppercase tracking-[0.16em]">
                      Your order · {count} {count === 1 ? "item" : "items"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep("cart")}
                      className="cart-link-muted text-xs font-semibold underline-offset-2 transition hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <ul className="mt-2.5 space-y-2.5 px-4">
                    {items.map((item) => (
                      <li key={item.slug} className="flex items-center gap-3">
                        <span className="cart-item-art relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          <StoreArtwork src={storeArtFor(item)} alt="" sizes="40px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{item.name}</span>
                          <span className="cart-muted block text-[11px]">
                            {item.qty} × {usd(item.price)}
                          </span>
                        </span>
                        <span className="telemetry text-xs font-bold">{usd(item.price * item.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  {discount > 0 && (
                    <div className="flex items-center justify-between px-4 pt-1 text-xs">
                      <span className="cart-muted">
                        {appliedCode?.code} · {appliedCode?.percentOff}% off
                      </span>
                      <span className="telemetry font-bold text-success">−{usd(discount)}</span>
                    </div>
                  )}
                  <div className="cart-summary-total mt-3.5 flex items-center justify-between px-4 py-3">
                    <span className="cart-muted text-xs">
                      Estimated total <span className="cart-muted-2">· no charge today</span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      {discount > 0 && (
                        <span className="cart-muted-2 telemetry text-xs line-through">{usd(shownSubtotal)}</span>
                      )}
                      <span className="telemetry text-[1rem] font-black">{usd(shownTotal)}</span>
                    </span>
                  </div>
                </section>

                <OrderRequestForm
                  configured={requestsConfigured}
                  appliedCode={appliedCode}
                />
              </div>
            )}
      </aside>
    </div>
  );
}
