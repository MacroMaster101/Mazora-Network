"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ChevronDown, Clock3, Crown, Flame, Gamepad2, Gem, Heart, House, Package, PackageSearch, Rocket, Shield, Sparkles, Sword, Wand2 } from "lucide-react";
import type { GameMode, Product, StoreCategoryConfig, StoreRoadmapConfig, StoreWelcomeBannerConfig } from "@/lib/types";
import { DEFAULT_STORE_ROADMAP, DEFAULT_STORE_WELCOME_BANNER } from "@/lib/types";
import { ProductCard } from "./product-card";
import { RankOfferCard } from "./rank-offer-card";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { readStoreReturnState, STORE_RETURN_KEY, STORE_RETURN_PENDING_KEY } from "@/lib/store-navigation";

type StoreView = Product["category"] | "All";

function getModeDisplayName(mode?: GameMode | null) {
  if (!mode) return "";
  return mode.name === "Survival SMP" ? "Survival" : mode.name;
}

function renderRoadmapIcon(iconKey: string, size = 18) {
  switch (iconKey.toLowerCase()) {
    case "sword":
    case "swords":
      return <Sword size={size} />;
    case "wand":
    case "magic":
      return <Wand2 size={size} />;
    case "sparkles":
    case "pet":
    case "pets":
      return <Sparkles size={size} />;
    case "shield":
    case "armor":
      return <Shield size={size} />;
    case "crown":
    case "vip":
      return <Crown size={size} />;
    case "gem":
    case "key":
      return <Gem size={size} />;
    case "rocket":
    case "booster":
      return <Rocket size={size} />;
    case "clock":
    case "time":
      return <Clock3 size={size} />;
    default:
      return <Package size={size} />;
  }
}

function getStatusBadgeStyle(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("dev")) {
    return "is-development";
  }
  if (lower.includes("soon")) {
    return "is-coming-soon";
  }
  if (lower.includes("plan")) {
    return "is-planned";
  }
  if (lower.includes("test")) {
    return "is-testing";
  }
  return "is-default";
}

export function StoreExplorer({
  products,
  modes,
  featuredSlugs,
  categoryConfigs,
  welcomeBanner = DEFAULT_STORE_WELCOME_BANNER,
  roadmap = DEFAULT_STORE_ROADMAP,
}: {
  products: Product[];
  modes: GameMode[];
  featuredSlugs: string[];
  categoryConfigs: StoreCategoryConfig[];
  welcomeBanner?: StoreWelcomeBannerConfig;
  roadmap?: StoreRoadmapConfig;
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
                <span className="store-mode-tab-icon"><Icon name={mode.icon || "Gamepad2"} size={15} /></span>
                <span>
                  <strong>{getModeDisplayName(mode)}</strong>
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
            <span className="store-mode-coming-soon-core">
              <Icon name={selectedMode?.icon || "Gamepad2"} size={36} />
            </span>
            <span className="store-mode-floating-icon is-one"><Icon name={selectedMode?.icon || "Gamepad2"} size={14} /></span>
            <span className="store-mode-floating-icon is-two"><Icon name={selectedMode?.icon || "Gamepad2"} size={13} /></span>
            <span className="store-mode-floating-icon is-three"><Icon name={selectedMode?.icon || "Gamepad2"} size={12} /></span>
          </div>
          <p className="eyebrow">Mode marketplace</p>
          <h2>{getModeDisplayName(selectedMode)} shop</h2>
          <p>
            This mode&apos;s items are still being designed and balanced. The store will open here when{" "}
            {getModeDisplayName(selectedMode)} rewards are ready.
          </p>
          <div>
            <Clock3 size={15} />
            Coming soon
          </div>
        </section>
      ) : (
        <>
      <nav className="store-shop-nav" aria-label={`${getModeDisplayName(selectedMode) || "Game mode"} store categories`}>
        <div className="store-shop-nav-main">
          <button type="button" onClick={() => chooseView("All")} className={cn("store-shop-nav-item", active === "All" && "is-active")} aria-pressed={active === "All"}>
            <House size={15} /> Store Home
          </button>

          {activeCategories.map((config) => config.useSubcategories ? (
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
          {welcomeBanner.enabled && (
            <section className="store-home-welcome-v3" aria-labelledby="store-welcome-title">
              <div className="store-home-welcome-content">
                <div className="store-home-welcome-header">
                  <span className="store-home-welcome-pill">
                    <Sparkles size={13} /> {welcomeBanner.badge}
                  </span>
                  <h2 id="store-welcome-title">{welcomeBanner.title}</h2>
                </div>
                <div className="store-home-welcome-body">
                  <p>{welcomeBanner.paragraph1}</p>
                  <p>{welcomeBanner.paragraph2}</p>
                </div>
                <div className="store-home-welcome-support">
                  <div className="store-home-welcome-support-icon">
                    <Heart size={18} />
                  </div>
                  <p>{welcomeBanner.supportNote}</p>
                </div>
              </div>
              <div className="store-home-welcome-media">
                <div className="store-home-welcome-media-aura" aria-hidden="true" />
                <div className="store-home-welcome-media-frame group">
                  <Image
                    src={
                      welcomeBanner.imageUrl?.startsWith("/images/store/") && welcomeBanner.imageUrl.endsWith(".png")
                        ? welcomeBanner.imageUrl.replace(/\.png$/, ".webp")
                        : welcomeBanner.imageUrl || "/images/vote-world-bg-v2.webp"
                    }
                    alt={welcomeBanner.title}
                    fill
                    sizes="(max-width: 900px) 100vw, 480px"
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    priority
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.endsWith("/images/vote-world-bg-v2.webp")) {
                        target.src = "/images/vote-world-bg-v2.webp";
                      }
                    }}
                  />
                  <div className="store-home-welcome-media-shimmer" aria-hidden="true" />
                  <div className="store-home-welcome-media-overlay" aria-hidden="true" />
                  <div className="store-home-welcome-media-badge">
                    <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <span>
                      Minecraft {getModeDisplayName(selectedMode) || "Survival"} · v{selectedMode?.version || "1.21.11"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="store-home-featured-v3" aria-labelledby="store-featured-title">
            <header className="store-home-featured-v3-head">
              <div>
                <span className="store-home-trending-pill">
                  <Flame size={13} className="text-amber-400" /> FEATURED UPGRADES
                </span>
                <h3 id="store-featured-title">Whats New & Trending?</h3>
                <p>Enjoy the new and trending upgrades to enhance your experience!</p>
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


          {roadmap.enabled && (
            <section className="store-home-roadmap-v3" aria-labelledby="store-roadmap-title">
              <div className="store-home-roadmap-header">
                <div>
                  <span className="store-home-roadmap-pill">
                    <Sparkles size={13} /> {roadmap.eyebrow}
                  </span>
                  <h3 id="store-roadmap-title">{roadmap.title}</h3>
                  {roadmap.subtitle && <p className="store-home-roadmap-desc">{roadmap.subtitle}</p>}
                </div>
              </div>

              <div className="store-home-roadmap-grid">
                {roadmap.items.filter((item) => item.enabled).map((item) => {
                  const statusClass = getStatusBadgeStyle(item.status);
                  return (
                    <div key={item.id} className="store-home-roadmap-card group">
                      <span className="store-home-roadmap-float" aria-hidden="true">
                        {renderRoadmapIcon(item.icon, 54)}
                      </span>
                      <div className="store-home-roadmap-card-head">
                        <div className="store-home-roadmap-card-icon">
                          {renderRoadmapIcon(item.icon)}
                        </div>
                        <span className={cn("store-home-roadmap-tag", statusClass)}>
                          <span className="store-home-roadmap-tag-dot" />
                          {item.status}
                        </span>
                      </div>
                      <h4 className="store-home-roadmap-card-title">{item.title}</h4>
                      {item.desc && <p className="store-home-roadmap-card-desc">{item.desc}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
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
