import type { GameMode, Product, StoreCategoryConfig } from "@/lib/types";
import { buildStoreHref, matchStoreParam, STORE_ALL_VIEW } from "@/lib/store-navigation";

export interface StoreView {
  /** Game mode whose catalogue is being shown. Always a mode that exists. */
  mode: string;
  /** The mode shown when ?mode is absent, so links can omit it again. */
  defaultMode: string;
  /** Category key, or "All" for the store home view. */
  category: string;
  /** Subcategory key within `category`, or null. */
  sub: string | null;
  /** Display label for the active category, or null on the home view. */
  categoryLabel: string | null;
  /** The active category's own description, used as the page description. */
  categoryDescription: string | null;
  /** Canonical path for this listing — subcategory deliberately excluded. */
  canonicalPath: string;
  /** False when the mode's store has not opened, i.e. the view has no products. */
  storeLive: boolean;
  /** True when this category exists but currently stocks nothing. */
  emptyListing: boolean;
}

/**
 * Turn /store's query string into the view to render.
 *
 * Shared by the page body and generateMetadata so the rendered listing and the
 * canonical URL can never disagree — the failure mode otherwise is a page that
 * shows Crate Keys while claiming to be the store home.
 *
 * Nothing here trusts the query string. A mode, category or subcategory that no
 * longer exists (renamed in the admin, disabled, or simply invented by a
 * crawler) falls back to the default view rather than rendering an empty
 * catalogue, and the canonical then points at what was actually rendered.
 */
export function resolveStoreView(
  params: { mode?: string; category?: string; sub?: string },
  modes: GameMode[],
  categoryConfigs: StoreCategoryConfig[],
  products: Product[],
): StoreView {
  const defaultMode = modes.find((mode) => mode.storeStatus === "live")?.slug ?? modes[0]?.slug ?? "";
  const mode = matchStoreParam(modes.map((entry) => entry.slug), params.mode) ?? defaultMode;
  const storeLive = modes.find((entry) => entry.slug === mode)?.storeStatus === "live";

  const modeCategories = categoryConfigs
    .filter((config) => config.gameModeSlug === mode && config.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const category = matchStoreParam(modeCategories.map((config) => config.key), params.category) ?? STORE_ALL_VIEW;
  const activeConfig = modeCategories.find((config) => config.key === category) ?? null;

  // Subcategories only exist for categories that opted into them; the nav shows
  // no submenu otherwise, so a ?sub on such a category is meaningless.
  const subKeys = activeConfig?.useSubcategories
    ? activeConfig.subcategories.filter((item) => item.enabled).map((item) => item.key)
    : [];
  const sub = matchStoreParam(subKeys, params.sub);

  /*
    A category with nothing in it yet. Staff create the category first and add
    products to it afterwards, so this is a normal state in the admin rather
    than an error — but in between, the nav links to a listing whose whole body
    is "No products found". Sitemap.ts already withholds those; this is the
    other half, so the one that is linked is not also declared indexable.
  */
  const emptyListing = category !== STORE_ALL_VIEW && !products.some(
    (product) => (product.gameModeSlug ?? "survival-smp") === mode && product.category === category,
  );

  return {
    mode,
    defaultMode,
    category,
    sub,
    categoryLabel: activeConfig?.label ?? null,
    categoryDescription: activeConfig?.description ?? null,
    canonicalPath: buildStoreHref({ mode, defaultMode, category }),
    storeLive,
    emptyListing,
  };
}
