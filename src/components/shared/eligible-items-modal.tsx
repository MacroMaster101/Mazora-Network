"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "@/components/ui/app-link";
import { Check, Copy, ExternalLink, Package, Plus, Search, Sparkles, Tag, X } from "lucide-react";
import type { PublicDiscountAlert, PublicDiscountAlertProduct } from "@/lib/store-discount";
import { useCart } from "./cart-provider";
import { usd } from "@/lib/utils";
import { useToast } from "@/components/ui";

interface EligibleItemsModalProps {
  alert: PublicDiscountAlert;
  alerts?: PublicDiscountAlert[];
  isOpen: boolean;
  onClose: () => void;
}

export function EligibleItemsModal({ alert, alerts, isOpen, onClose }: EligibleItemsModalProps) {
  const { add, openCart } = useCart();
  const { toast } = useToast();
  const [selectedCode, setSelectedCode] = useState(alert.code);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const titleId = useId();

  // Sync selected code if initial alert changes
  useEffect(() => {
    setSelectedCode(alert.code);
  }, [alert.code]);

  const currentAlert = alerts?.find((a) => a.code === selectedCode) ?? alert;

  // Close on Escape & prevent background scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return currentAlert.eligibleProducts;
    return currentAlert.eligibleProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q)),
    );
  }, [currentAlert.eligibleProducts, search]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentAlert.code);
      }
      setCopied(true);
      toast(`Code ${currentAlert.code} copied! (${currentAlert.percentOff}% off eligible items)`, "success");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast(`Code: ${currentAlert.code}`, "info");
    }
  };

  const handleAddToCart = (product: PublicDiscountAlertProduct) => {
    // Construct minimal Product instance for cart provider
    add({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      salePrice: product.salePrice ?? undefined,
      category: product.category as never,
      subcategory: product.subcategory ?? undefined,
      accent: (product.accent as never) ?? "violet",
      description: "",
      features: [],
      gameModeSlug: "survival-smp",
    });
    openCart();
    toast(`Added ${product.name} to cart!`, "success");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Shell */}
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-violet-200/90 bg-white shadow-[0_25px_60px_-15px_rgba(35,21,53,0.3)] dark:border-violet-500/40 dark:bg-[#181126] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(139,92,246,0.2)] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative border-b border-line/70 p-4 sm:p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-100/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-200">
                  <Sparkles size={11} className="text-amber-500 dark:text-amber-300" aria-hidden="true" />
                  {currentAlert.badge}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {currentAlert.percentOff}% OFF PROMOTION
                </span>
              </div>
              <h2 id={titleId} className="mt-1.5 text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Eligible Promotion Items
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                {currentAlert.isAllProducts
                  ? "Good news! This discount code applies to every product across our entire store."
                  : `This discount code applies to the ${currentAlert.eligibleProducts.length} hand-picked items listed below.`}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-violet-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close eligible items dialog"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Multiple Promotions Tabs */}
          {alerts && alerts.length > 1 && (
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {alerts.map((item) => {
                const isActive = item.code === currentAlert.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setSelectedCode(item.code);
                      setSearch("");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                      isActive
                        ? "bg-violet-600 text-white shadow-sm shadow-violet-500/30 dark:bg-violet-600"
                        : "border border-line/70 bg-card/60 text-muted hover:border-violet-300 hover:text-foreground dark:hover:border-violet-500/40"
                    }`}
                  >
                    <span>{item.code}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-extrabold ${isActive ? "bg-white/20 text-white" : "bg-ink/10 text-muted"}`}>
                      {item.percentOff}% OFF
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Promotion code banner with copy */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200/80 bg-violet-50/70 p-2.5 dark:border-violet-500/30 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <Tag size={15} className="text-violet-600 dark:text-violet-300" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Code:{" "}
                <span className="font-mono font-black text-violet-700 dark:text-violet-200">
                  {currentAlert.code}
                </span>
              </span>
              <span className="rounded bg-violet-200/70 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-500/30 dark:text-violet-200">
                {currentAlert.percentOff}% OFF
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all duration-200 ${
                copied
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-200 dark:border-emerald-500/40"
                  : "border border-violet-200 bg-white hover:bg-violet-50 text-violet-950 shadow-xs dark:border-violet-500/40 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white"
              }`}
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} className="text-violet-600 dark:text-violet-200" aria-hidden="true" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Search bar if multiple products exist */}
          {currentAlert.eligibleProducts.length > 3 && (
            <div className="relative mt-3">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search eligible items by name or category..."
                className="h-9 w-full rounded-xl border border-line bg-card/60 pl-8 pr-3 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredProducts.length === 0 ? (
            <div className="grid place-items-center py-10 text-center">
              <Package size={28} className="text-muted" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-ink">No matching items found</p>
              <p className="mt-0.5 text-xs text-muted">Try a different search query</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredProducts.map((product) => {
                const basePrice = product.salePrice ?? product.price;
                const discountedPrice = Math.max(
                  Math.round(basePrice * (1 - currentAlert.percentOff / 100) * 100) / 100,
                  0,
                );
                const savings = Math.round((basePrice - discountedPrice) * 100) / 100;

                return (
                  <div
                    key={product.id || product.slug}
                    className="group relative flex flex-col justify-between rounded-2xl border border-line/80 bg-card/70 p-3.5 transition-all hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-md bg-ink/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-muted">
                          {product.subcategory ?? product.category}
                        </span>
                        <span className="rounded-full border border-violet-300/40 bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-200">
                          Save {usd(savings)}
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-sm font-extrabold text-slate-900 transition-colors group-hover:text-violet-600 dark:text-white dark:group-hover:text-accent-bright">
                        {product.name}
                      </h3>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-line/50 pt-2.5">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-violet-700 dark:text-violet-200">
                            {usd(discountedPrice)}
                          </span>
                          <span className="text-xs text-muted line-through">
                            {usd(basePrice)}
                          </span>
                        </div>
                        <span className="block text-[9px] font-medium text-slate-500 dark:text-slate-400">
                          with code {currentAlert.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/store/${product.slug}`}
                          onClick={onClose}
                          className="grid h-8 w-8 place-items-center rounded-xl border border-line/70 text-muted transition-colors hover:border-violet-300 hover:text-foreground dark:hover:border-violet-500/40"
                          title="View product details"
                          aria-label={`View ${product.name} details`}
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(product)}
                          className="inline-flex items-center gap-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors dark:bg-violet-600 dark:hover:bg-violet-500"
                        >
                          <Plus size={13} aria-hidden="true" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line/70 bg-ink/5 p-4 sm:px-6">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"} available
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-line px-3.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-ink/10"
            >
              Close
            </button>
            <Link
              href="/store"
              onClick={onClose}
              className="rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:brightness-110"
            >
              Go to Store
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
