"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDownUp, Clock3, Gamepad2, PackageSearch, Search, Sparkles, Lock, Sword, PawPrint, Coins } from "lucide-react";
import type { GameMode, Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { RankOfferCard } from "./rank-offer-card";
import { cn } from "@/lib/utils";
import { storeCategoryDetails, bundleArtFor } from "@/lib/store-art";

type SortMode = "featured" | "low" | "high";

const weaponBundles = [
  { name: "Frost Bundle", accent: "cyan" },
  { name: "Abominable Bundle", accent: "violet" },
  { name: "Demon Lord Bundle", accent: "rose" },
  { name: "Soul Bundle", accent: "green" },
] as const;

const comingSoonSections = [
  {
    title: "Weapons",
    eyebrow: "Custom arsenal",
    description: "Individual custom weapons are coming to the Survival store.",
    icon: "sword" as const,
  },
  {
    title: "Custom Pets",
    eyebrow: "Adventure companions",
    description: "Collectible Survival pets are currently in development.",
    icon: "paw" as const,
  },
  {
    title: "Tokens",
    eyebrow: "Network currency",
    description: "Token packages will become available in a future store update.",
    icon: "coins" as const,
  },
] as const;

export function StoreExplorer({ products, modes }: { products: Product[]; modes: GameMode[] }) {
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))),
    [products],
  );
  const [activeMode, setActiveMode] = useState("survival-smp");
  const [active, setActive] = useState<Product["category"] | "All">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("featured");

  const list = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const inCategory = active === "All" || product.category === active;
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery);
      return inCategory && matchesQuery;
    });

    if (sort === "low") {
      return [...filtered].sort(
        (a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price),
      );
    }
    if (sort === "high") {
      return [...filtered].sort(
        (a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price),
      );
    }
    return filtered;
  }, [products, active, query, sort]);

  const groupedProducts = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          products: list.filter((product) => product.category === category),
        }))
        .filter((group) => group.products.length > 0),
    [categories, list],
  );

  const selectedMode = modes.find((mode) => mode.slug === activeMode) ?? modes[0];

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

  return (
    <div id="catalog" className="scroll-mt-24">
      <div className="store-mode-selector">
        <div className="store-mode-selector-intro">
          <span><Gamepad2 size={15} /> Select a game mode</span>
          <p>Each mode has its own catalog and progression.</p>
        </div>
        <div className="store-mode-tabs" role="group" aria-label="Shop game modes">
          {modes.map((mode) => {
            const isLive = mode.slug === "survival-smp";
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
                  <small>{isLive ? "Store live" : "Coming soon"}</small>
                </span>
                <i className={isLive ? "is-live" : ""} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {activeMode !== "survival-smp" ? (
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
      <div className="store-catalog-heading">
        <div className="store-catalog-kicker">
          <span>01</span>
          <p>Choose your upgrade</p>
        </div>
        <div className="max-w-5xl">
          <p className="eyebrow">Survival SMP marketplace</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Build your Survival legacy.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
            Ranks, crate keys, battlepass upgrades and progression add-ons - organized exactly for the Survival experience.
          </p>
        </div>
        <p className="store-catalog-count telemetry">
          <Sparkles size={14} /> {displayCount(list)} {displayCount(list) === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="store-catalog-toolbar mt-7">
        <div className="store-category-tabs" role="group" aria-label="Product categories">
          {["All", ...categories].map((category) => {
            const categoryProducts =
              category === "All"
                ? products
                : products.filter((product) => product.category === category);
            const categoryCount = displayCount(categoryProducts);
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActive(category as Product["category"] | "All")}
                className={cn("store-category-tab", active === category && "is-active")}
                aria-pressed={active === category}
              >
                {category}
                <span>{categoryCount}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-[38rem]">
          <label className="store-search">
            <Search size={16} />
            <span className="sr-only">Search products</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the store"
            />
          </label>
          <label className="store-sort">
            <ArrowDownUp size={15} />
            <span className="sr-only">Sort products</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="featured">Featured</option>
              <option value="low">Price: low</option>
              <option value="high">Price: high</option>
            </select>
          </label>
        </div>
      </div>

      {list.length > 0 ? (
        <div className="store-category-sections">
          {groupedProducts.map(({ category, products: categoryProducts }, index) => {
            const details = storeCategoryDetails[category];
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
                    <p className="eyebrow">{details.eyebrow}</p>
                    <h3 id={`${categoryId(category)}-title`} className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                      {category}
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{details.description}</p>
                  </div>
                  <div className="store-section-total telemetry">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </div>
                </div>

                {category === "Ranks" ? (
                  <div className="store-rank-grid">
                    {rankFamilies(categoryProducts).map((rank) => (
                      <RankOfferCard key={rank.family} family={rank.family} products={rank.products} />
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
                            <ProductCard key={product.slug} product={product} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn("store-product-deck", categoryProducts.length > 3 && "store-product-grid")} data-count={categoryProducts.length}>
                    {categoryProducts.map((product) => (
                      <ProductCard key={product.slug} product={product} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Weapon Bundles — real artwork cards */}
          {active === "All" && !query && (
            <section className="store-category-section" id="shop-weapon-bundles">
              <div className="store-category-section-head">
                <div className="store-section-number telemetry">{String(groupedProducts.length + 1).padStart(2, "0")}</div>
                <div>
                  <p className="eyebrow">Forged for battle</p>
                  <h3 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Weapon Bundles</h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">Four themed Survival weapon collections are being prepared.</p>
                </div>
              </div>
              <div className="store-coming-soon-deck">
                {weaponBundles.map((bundle) => (
                  <div key={bundle.name} className="store-coming-soon-card store-bundle-card group" data-accent={bundle.accent}>
                    <div className="store-coming-soon-card-media store-bundle-card-media">
                      <Image
                        src={bundleArtFor(bundle.name)}
                        alt={bundle.name}
                        fill
                        className="object-contain p-4"
                        sizes="(max-width: 640px) 100vw, 25vw"
                      />
                      <div className="store-coming-soon-card-lock">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="store-coming-soon-card-body">
                      <span>{bundle.name}</span>
                      <span className="store-coming-soon-badge">Coming Soon</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Other coming soon — single card per section */}
          {active === "All" && !query && comingSoonSections.map((section, index) => (
            <section key={section.title} className="store-category-section" id={`shop-${section.title.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="store-category-section-head">
                <div className="store-section-number telemetry">{String(groupedProducts.length + index + 2).padStart(2, "0")}</div>
                <div>
                  <p className="eyebrow">{section.eyebrow}</p>
                  <h3 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{section.title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{section.description}</p>
                </div>
              </div>
              <div className="store-coming-soon-deck store-coming-soon-single">
                <div className="store-coming-soon-card store-coming-soon-card-wide group">
                  <div className="store-coming-soon-card-media">
                    <div className="store-coming-soon-card-glow" />
                    <div className="store-coming-soon-card-icon">
                      {section.icon === "sword" && <Sword className="w-10 h-10 stroke-[1.25]" />}
                      {section.icon === "paw" && <PawPrint className="w-10 h-10 stroke-[1.25]" />}
                      {section.icon === "coins" && <Coins className="w-10 h-10 stroke-[1.25]" />}
                    </div>
                    <div className="store-coming-soon-card-lock">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="store-coming-soon-card-body">
                    <span>{section.title}</span>
                    <span className="store-coming-soon-badge">Coming Soon</span>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-7 flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong bg-card/40 px-6 text-center">
          <PackageSearch size={34} className="text-accent-bright" />
          <h3 className="mt-4 text-lg font-bold">No products found</h3>
          <p className="mt-1 text-sm text-muted">Try another search or switch categories.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActive("All");
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
