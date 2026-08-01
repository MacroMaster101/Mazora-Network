"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ArrowRight, ChevronDown, Clock3, Gamepad2, House, PackageSearch, Sparkles } from "lucide-react";
import type { GameMode, Product, StoreCategoryConfig } from "@/lib/types";
import { ProductCard } from "./product-card";
import { RankOfferCard } from "./rank-offer-card";
import { cn } from "@/lib/utils";
import { readStoreReturnState, STORE_RETURN_KEY, STORE_RETURN_PENDING_KEY } from "@/lib/store-navigation";

type StoreView = Product["category"] | "All";

export function StoreExplorer({
  products,
  modes,
  featuredSlugs,
  categoryConfigs,
}: {
  products: Product[];
  modes: GameMode[];
  featuredSlugs: string[];
  categoryConfigs: StoreCategoryConfig[];
}) {
  const availableModes = modes;
  const defaultMode = availableModes.find((mode) => mode.storeStatus === "live")?.slug ?? availableModes[0]?.slug ?? "";
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [active, setActive] = useState<StoreView>("All");
  const [subfilter, setSubfilter] = useState<string | null>(null);
  const activeCategories = useMemo(
    () => categoryConfigs.filter((config) => config.gameModeSlug === activeMode && config.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [categoryConfigs, activeMode],
  );

  useEffect(() => {
    if (active !== "All" && !activeCategories.some((config) => config.key === active)) {
      setActive("All");
      setSubfilter(null);
    }
  }, [active, activeCategories]);
  useEffect(() => {
    if (window.sessionStorage.getItem(STORE_RETURN_PENDING_KEY) !== "1") return;
    window.sessionStorage.removeItem(STORE_RETURN_PENDING_KEY);
    const saved = readStoreReturnState();
    if (!saved) return;

    setActiveMode(availableModes.some((mode) => mode.slug === saved.activeMode) ? saved.activeMode : defaultMode);
    setActive(saved.active as StoreView);
    setSubfilter(saved.subfilter);

    const restoreScroll = () => window.scrollTo({ top: saved.scrollY, behavior: "instant" });
    window.requestAnimationFrame(() => window.requestAnimationFrame(restoreScroll));
    window.setTimeout(restoreScroll, 300);
    window.setTimeout(restoreScroll, 900);
    window.setTimeout(restoreScroll, 1600);
  }, [availableModes, defaultMode]);

  const list = useMemo(
    () =>
      products.filter((product) => {
        if ((product.gameModeSlug ?? "survival-smp") !== activeMode) return false;
        const inCategory =
          active === "All" ||
          product.category === active;
        const inSubcategory = !subfilter || (product.subcategory ?? product.billing) === subfilter;
        return inCategory && inSubcategory;
      }),
    [products, activeMode, active, subfilter],
  );
  const groupedProducts = useMemo(
    () =>
      activeCategories
        .map((config) => ({
          category: config.key,
          config,
          products: list.filter((product) => product.category === config.key),
        }))
        .filter((group) => group.products.length > 0),
    [activeCategories, list],
  );

  const newArrivals = featuredSlugs.flatMap(
    (slug) => products.find((product) => product.slug === slug && (product.gameModeSlug ?? "survival-smp") === activeMode) ?? [],
  );
  const selectedMode = availableModes.find((mode) => mode.slug === activeMode) ?? availableModes[0];

  function displayCount(source: Product[]) {
    return new Set(source.map((product) => product.family ?? product.slug)).size;
  }

  function categoryId(category: string) {
    return `shop-${category.toLowerCase().replace(/\s+/g, "-")}`;
  }

  function rankFamilies(source: Product[]) {
    return Array.from(new Set(source.map((product) => product.family).filter(Boolean))).map((family) => ({
      family: family!,
      products: source.filter((product) => product.family === family),
    }));
  }

  function addonGroups(source: Product[]) {
    return Array.from(new Set(source.map((product) => product.subcategory).filter(Boolean))).map((subcategory) => ({
      subcategory: subcategory!,
      products: source.filter((product) => product.subcategory === subcategory),
    }));
  }

  function chooseView(view: StoreView, nextSubfilter: string | null = null) {
    setActive(view);
    setSubfilter(nextSubfilter);
  }

  function rememberStorePosition() {
    window.sessionStorage.setItem(STORE_RETURN_KEY, JSON.stringify({
      activeMode,
      active,
      subfilter,
      scrollY: window.scrollY,
      savedAt: Date.now(),
    }));
  }

  function chooseFromMenu(
    event: MouseEvent<HTMLButtonElement>,
    view: StoreView,
    nextSubfilter: string | null = null,
  ) {
    chooseView(view, nextSubfilter);
    event.currentTarget.closest("details")?.removeAttribute("open");
  }
  return (
    <div id="catalog" className="scroll-mt-24">
      <div className="store-mode-selector">
        <div className="store-mode-selector-intro">
          <span><Gamepad2 size={15} /> Select a game mode</span>
          <p>Each mode has its own catalog and progression.</p>
        </div>
        <div className="store-mode-tabs" role="group" aria-label="Shop game modes">
          {availableModes.map((mode) => {
            const isLive = mode.storeStatus === "live";
            return (
              <button
                key={mode.slug}
                type="button"
                onClick={() => setActiveMode(mode.slug)}
                className={cn("store-mode-tab", activeMode === mode.slug && "is-active")}
                aria-pressed={activeMode === mode.slug}
              >
                <span className="store-mode-tab-icon"><Gamepad2 size={15} /></span>
                <span>
                  <strong>{mode.name}</strong>
                  <small>{mode.tagline || (isLive ? "Store live" : "Coming soon")}</small>
                </span>
                <i className={isLive ? "is-live" : ""} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {selectedMode?.storeStatus !== "live" ? (
        <section className="store-mode-coming-soon">
          <div className="store-mode-coming-soon-orbit" aria-hidden="true">
            <span />
            <span />
            <Gamepad2 size={34} />
          </div>
          <p className="eyebrow">Mode marketplace</p>
          <h2>{selectedMode?.name} shop</h2>
          <p>
            This mode&apos;s items are still being designed and balanced. The store will open here when
            {selectedMode?.name} rewards are ready.
          </p>
          <div>
            <Clock3 size={15} />
            Coming soon
          </div>
        </section>
      ) : (
        <>
      <nav className="store-shop-nav" aria-label={`${selectedMode?.name ?? "Game mode"} store categories`}>
        <div className="store-shop-nav-main">
          <button type="button" onClick={() => chooseView("All")} className={cn("store-shop-nav-item", active === "All" && "is-active")} aria-pressed={active === "All"}>
            <House size={15} /> Store Home
          </button>

          {activeCategories.map((config) => config.useSubcategories && config.subcategories.some((item) => item.enabled) ? (
            <details key={config.key} className={cn("store-shop-menu", active === config.key && "is-active")}>
              <summary className="store-shop-nav-item">{config.label} <ChevronDown size={14} /></summary>
              <div className="store-shop-submenu">
                <button type="button" onClick={(event) => chooseFromMenu(event, config.key)}>All {config.label}</button>
                {config.subcategories.filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                  <button key={item.key} type="button" onClick={(event) => chooseFromMenu(event, config.key, item.key)}>{item.label}</button>
                ))}
              </div>
            </details>
          ) : (
            <button key={config.key} type="button" onClick={() => chooseView(config.key)} className={cn("store-shop-nav-item", active === config.key && "is-active")} aria-pressed={active === config.key}>
              {config.label}
            </button>
          ))}
        </div>
      </nav>

      {active === "All" ? (
        <div className="store-home-view store-home-v3">
          <section className="store-home-featured-v3" aria-labelledby="store-featured-title">
            <header className="store-home-featured-v3-head">
              <div>
                <p className="eyebrow">Admin-curated loadout</p>
                <h3 id="store-featured-title">Featured in the marketplace.</h3>
                <p>Three standout upgrades selected by the Mazora team and updated directly from Store administration.</p>
              </div>
              <span className="telemetry"><Sparkles size={13} /> {newArrivals.length} live picks</span>
            </header>
            <div className="store-home-featured-v3-grid" data-count={newArrivals.length}>
              {newArrivals.map((product, index) => (
                <div key={product.slug} className="store-home-featured-v3-item">
                  <span className="store-home-featured-v3-index telemetry">{String(index + 1).padStart(2, "0")}</span>
                  <ProductCard product={product} onOpenDetails={rememberStorePosition} />
                </div>
              ))}
            </div>
          </section>

          <section className="store-home-category-hub" aria-labelledby="store-category-hub-title">
            <div className="store-home-category-hub-intro">
              <p className="eyebrow">Explore the catalog</p>
              <h3 id="store-category-hub-title">Choose your next upgrade.</h3>
              <p>Jump directly to the part of the {selectedMode?.name ?? "server"} marketplace that fits your play style.</p>
              <span className="telemetry">{String(activeCategories.length).padStart(2, "0")} collections · {displayCount(products.filter((product) => (product.gameModeSlug ?? "survival-smp") === activeMode))} offers</span>
            </div>

            <div className="store-home-category-v3-grid">
              {activeCategories.map((config, index) => (
                <article key={config.key} className={`store-home-category-v3 accent-${config.accent}`}>
                  <span className="telemetry">{String(index + 1).padStart(2, "0")} · {config.eyebrow}</span>
                  <h4>{config.label}</h4>
                  <p>{config.description}</p>
                  {config.useSubcategories && config.subcategories.some((item) => item.enabled) ? (
                    <div>
                      {config.subcategories.filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 3).map((item) => (
                        <button key={item.key} type="button" onClick={() => chooseView(config.key, item.key)}>{item.label}</button>
                      ))}
                    </div>
                  ) : (
                    <button type="button" onClick={() => chooseView(config.key)}>Browse {config.label.toLowerCase()} <ArrowRight size={14} /></button>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section className="store-home-roadmap-v3" aria-label="Coming next">
            <div>
              <p className="eyebrow">Marketplace roadmap</p>
              <h3>More ways to stand out.</h3>
            </div>
            <div>
              <span>Weapon Bundles <small>Soon</small></span>
              <span>Custom Weapons <small>Soon</small></span>
              <span>Custom Pets <small>Soon</small></span>
            </div>
          </section>
        </div>
      ) : list.length > 0 ? (
        <div className="store-category-sections">
          {groupedProducts.map(({ category, config, products: categoryProducts }, index) => {
            const itemCount = displayCount(categoryProducts);
            return (
              <section
                key={category}
                id={categoryId(category)}
                className="store-category-section"
                aria-labelledby={`${categoryId(category)}-title`}
              >
                <div className="store-category-section-head">
                  <div className="store-section-number telemetry">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <p className="eyebrow">{config.eyebrow}</p>
                    <h3 id={`${categoryId(category)}-title`} className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                      {config.label}
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{config.description}</p>
                  </div>
                  <div className="store-section-total telemetry">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </div>
                </div>

                {category === "Ranks" ? (
                  <div className="store-rank-grid">
                    {rankFamilies(categoryProducts).map((rank) => (
                      <RankOfferCard key={rank.family} family={rank.family} products={rank.products} onOpenDetails={rememberStorePosition} />
                    ))}
                  </div>
                ) : category === "Add-ons" ? (
                  <div className="store-addon-groups">
                    {addonGroups(categoryProducts).map((group) => (
                      <div key={group.subcategory} className="store-addon-group">
                        <div className="store-addon-group-head">
                          <span />
                          <h4>{group.subcategory}</h4>
                          <small>{group.products.length} options</small>
                        </div>
                        <div className={cn("store-product-deck", group.products.length > 3 && "store-product-grid")} data-count={group.products.length}>
                          {group.products.map((product) => (
                            <ProductCard key={product.slug} product={product} onOpenDetails={rememberStorePosition} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn("store-product-deck", categoryProducts.length > 3 && "store-product-grid")} data-count={categoryProducts.length}>
                    {categoryProducts.map((product) => (
                      <ProductCard key={product.slug} product={product} onOpenDetails={rememberStorePosition} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        </div>
      ) : (
        <div className="mt-7 flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong bg-card/40 px-6 text-center">
          <PackageSearch size={34} className="text-accent-bright" />
          <h3 className="mt-4 text-lg font-bold">No products found</h3>
          <p className="mt-1 text-sm text-muted">Choose another category to continue browsing.</p>
          <button
            type="button"
            onClick={() => {
              setActive("All");
              setSubfilter(null);
            }}
            className="btn btn-ghost btn-sm mt-5"
          >
            Reset filters
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}
