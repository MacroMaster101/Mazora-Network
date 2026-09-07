"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { MAX_STORE_FEATURED_SLUGS, MIN_STORE_FEATURED_SLUGS, type Product } from "@/lib/types";
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
  // Whatever is saved, not a fixed three. A first-time store with nothing saved
  // still needs one row to choose from.
  const initial = (selectedSlugs.length ? selectedSlugs : products.slice(0, 3).map((product) => product.slug))
    .filter((slug, index, all) => all.indexOf(slug) === index)
    .slice(0, MAX_STORE_FEATURED_SLUGS);
  const [slots, setSlots] = useState(initial.length ? initial : products.slice(0, 1).map((p) => p.slug));
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );

  function updateSlot(index: number, slug: string) {
    setSlots((current) => current.map((value, slot) => (slot === index ? slug : value)));
  }

  function addSlot() {
    setSlots((current) => {
      if (current.length >= MAX_STORE_FEATURED_SLUGS) return current;
      // Open the new slot on something not already featured, so the duplicate
      // check does not reject the save the moment a slot is added.
      const unused = products.find((product) => !current.includes(product.slug));
      return [...current, unused?.slug ?? products[0]?.slug ?? ""];
    });
  }

  function removeSlot(index: number) {
    setSlots((current) => (
      current.length <= MIN_STORE_FEATURED_SLUGS ? current : current.filter((_, slot) => slot !== index)
    ));
  }

  const duplicates = slots.length !== new Set(slots).size;
  const atMax = slots.length >= MAX_STORE_FEATURED_SLUGS;

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
          Choose the products shown first on the public Store Home, between {MIN_STORE_FEATURED_SLUGS} and{" "}
          {MAX_STORE_FEATURED_SLUGS} of them. Slot order is preserved, and the Store Home row reflows to fit
          however many you pick.
        </p>
      </div>

      <div className="store-admin-featured-grid grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((slug, index) => {
          const product = productBySlug.get(slug);
          return (
            <label key={index} className="store-admin-featured-slot rounded-2xl border border-line bg-card/55 p-4">
              <span className="flex items-center justify-between gap-2">
                <span className="telemetry text-[0.62rem] uppercase tracking-[0.2em] text-accent-bright">
                  Featured slot {String(index + 1).padStart(2, "0")}
                </span>
                {slots.length > MIN_STORE_FEATURED_SLUGS && (
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="btn btn-ghost btn-xs text-danger"
                    aria-label={`Remove featured slot ${index + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
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
        <p className="text-xs text-muted">
          {duplicates
            ? "Two slots hold the same product. Change one before saving."
            : `${slots.length} of ${MAX_STORE_FEATURED_SLUGS} slots used.`}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addSlot}
            disabled={atMax || products.length <= slots.length}
            className="btn btn-secondary btn-sm"
          >
            <Plus size={14} /> Add slot
          </button>
          <button type="submit" disabled={busy || duplicates || products.length === 0} className="btn btn-primary btn-sm">
            <Save size={14} /> {busy ? "Saving…" : "Save featured picks"}
          </button>
        </span>
      </div>
    </form>
  );
}
