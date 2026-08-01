"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";
import type { StoreSettingsActionResult } from "@/lib/actions/store-settings";
import { Select, useToast } from "@/components/ui";
import { usd } from "@/lib/utils";

export function StoreFeaturedPicksEditor({
  products,
  selectedSlugs,
  saveAction,
}: {
  products: Product[];
  selectedSlugs: string[];
  saveAction: (formData: FormData) => Promise<StoreSettingsActionResult>;
}) {
  const initial = [...selectedSlugs, ...products.map((product) => product.slug)]
    .filter((slug, index, all) => all.indexOf(slug) === index)
    .slice(0, 3);
  const [slots, setSlots] = useState(initial);
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );

  function updateSlot(index: number, slug: string) {
    setSlots((current) => current.map((value, slot) => (slot === index ? slug : value)));
  }

  return (
    <form
      action={(formData) =>
        start(async () => {
          const result = await saveAction(formData);
          toast(result.message, result.ok ? "success" : "error");
        })
      }
      className="store-admin-featured cr-board mb-6 overflow-hidden"
    >
      <div className="border-b border-line px-5 py-4">
        <p className="eyebrow flex items-center gap-2"><Sparkles size={13} /> Store merchandising</p>
        <h2 className="mt-2 font-display text-xl font-black tracking-tight">Featured picks</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Choose the three products shown first on the public Store Home. Their slot order is preserved.
        </p>
      </div>

      <div className="store-admin-featured-grid grid gap-4 p-5 lg:grid-cols-3">
        {slots.map((slug, index) => {
          const product = productBySlug.get(slug);
          return (
            <label key={index} className="store-admin-featured-slot rounded-2xl border border-line bg-card/55 p-4">
              <span className="telemetry text-[0.62rem] uppercase tracking-[0.2em] text-accent-bright">
                Featured slot {String(index + 1).padStart(2, "0")}
              </span>
              <Select
                name="featuredSlugs"
                value={slug}
                onChange={(event) => updateSlot(index, event.target.value)}
                className="mt-3 w-full"
                aria-label={`Featured product slot ${index + 1}`}
              >
                {products.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name} · {option.category}
                  </option>
                ))}
              </Select>
              {product && (
                <span className="mt-4 block border-t border-line/70 pt-3">
                  <strong className="block text-sm">{product.name}</strong>
                  <span className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{product.category}</span>
                    <span className="telemetry">{usd(product.salePrice ?? product.price)}</span>
                  </span>
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
        <p className="text-xs text-muted">Selecting the same product twice will be rejected.</p>
        <button type="submit" disabled={busy || products.length < 3} className="btn btn-primary btn-sm">
          <Save size={14} /> {busy ? "Saving…" : "Save featured picks"}
        </button>
      </div>
    </form>
  );
}
