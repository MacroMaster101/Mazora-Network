"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { ChevronDown, Clock3, Crown, Flame, Gamepad2, Gem, Heart, House, Package, PackageSearch, Rocket, Shield, Sparkles, Sword, Wand2 } from "lucide-react";
import type { GameMode, Product, StoreCategoryConfig, StoreRoadmapConfig, StoreWelcomeBannerConfig } from "@/lib/types";
import { DEFAULT_STORE_ROADMAP, DEFAULT_STORE_WELCOME_BANNER } from "@/lib/types";
import { ProductCard } from "./product-card";
import { RankOfferCard } from "./rank-offer-card";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import {
  buildStoreHref,
  readStoreReturnState,
  shouldReapplyStoreScroll,
  STORE_ALL_VIEW,
  STORE_DETAIL_FROM_STORE_KEY,
  STORE_RETURN_KEY,
  STORE_RETURN_PENDING_KEY,
} from "@/lib/store-navigation";
import type { StoreView as StoreViewState } from "@/lib/store-view";

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
  view,
}: {
  products: Product[];
  modes: GameMode[];
  featuredSlugs: string[];
  categoryConfigs: StoreCategoryConfig[];
  welcomeBanner?: StoreWelcomeBannerConfig;
  roadmap?: StoreRoadmapConfig;
  view: StoreViewState;
}) {
  const availableModes = modes;

  /*
    The selection is read from the URL, not held in state.

    It was useState, which made the category nav a row of <button>s with nothing
    behind them: no shareable link to a category, no Back, and — the reason this
    changed — no href for a crawler to follow, so 33 of 36 product pages had no
    internal link anywhere on the site. The server now resolves ?mode/?category/
    ?sub in resolveStoreView() and renders that listing directly, so the first
    response already contains the products and their links.

    Every value below is validated server-side; an unknown parameter has already
    fallen back to the default view by the time it arrives here, which is why
    there is no longer a reconciliation effect guarding against a stale category.
  */
  const { mode: activeMode, defaultMode, category: active, sub: subfilter } = view;
  const activeCategories = useMemo(
    () => categoryConfigs.filter((config) => config.gameModeSlug === activeMode && config.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [categoryConfigs, activeMode],
  );

  const navRef = useRef<HTMLElement | null>(null);

  const closeAllMenus = useCallback(() => {
    navRef.current?.querySelectorAll<HTMLDetailsElement>("details.store-shop-menu[open]")
      .forEach((menu) => menu.removeAttribute("open"));
  }, []);

  /*
    A <details> menu holds its own open state in the DOM, and nothing about
    changing category tells it to close.

    Three ways it was left hanging open over the page it had just navigated
    away from: picking a different top-level category while a menu was open
    (the click never reaches the menu, so the link's own onClick cannot help),
    clicking anywhere else on the page, and pressing Escape. The first is the
    one that looked broken — Battlepass would load underneath an open Cosmetics
    menu — and it is handled by closing on every view change rather than by
    wiring a handler onto each sibling link, so a nav item added later cannot
    forget to do it.
  */
  useEffect(closeAllMenus, [closeAllMenus, activeMode, active, subfilter]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      // A click inside the nav is either opening a menu or following a link;
      // both are handled elsewhere, and closing here would beat the link to it.
      if (navRef.current?.contains(event.target)) return;
      closeAllMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const open = navRef.current?.querySelector<HTMLDetailsElement>("details.store-shop-menu[open]");
      if (!open) return;
      closeAllMenus();
      // Escape on a dropdown should leave focus where the reader can carry on
      // with the keyboard, not stranded on a summary that no longer expands.
      open.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAllMenus]);

  /*
    Scroll restoration only. Which category to show used to be restored from
    sessionStorage too; the URL carries it now, and re-applying a stale copy over
    the top would fight the address bar on Back.

    It retries because the offset is often unreachable on the first frame — the
    product art has not loaded, so the document is still shorter than the offset
    it is being asked to scroll to — and it stops the moment the offset is
    reached or the reader touches the page. See shouldReapplyStoreScroll.
  */
  useEffect(() => {
    if (window.sessionStorage.getItem(STORE_RETURN_PENDING_KEY) !== "1") return;
    window.sessionStorage.removeItem(STORE_RETURN_PENDING_KEY);
    const saved = readStoreReturnState();
    if (!saved) return;

    const startedAt = Date.now();
    let cancelled = false;
    let frame = 0;

    /*
      Anything that means the reader is driving. These are the input events
      themselves rather than the scroll event, because the restore's own
      scrollTo raises scroll too and cannot be told apart from a real one.
      Pointer covers dragging the scrollbar, which fires no wheel event.
    */
    const takeOver = () => { cancelled = true; };

    const stop = () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", takeOver);
      window.removeEventListener("touchstart", takeOver);
      window.removeEventListener("pointerdown", takeOver);
      window.removeEventListener("keydown", takeOver);
    };

    const tick = () => {
      const again = shouldReapplyStoreScroll({
        cancelled,
        elapsedMs: Date.now() - startedAt,
        currentY: window.scrollY,
        targetY: saved.scrollY,
      });
      if (!again) {
        stop();
        return;
      }
      // "instant" is required, not stylistic: html carries scroll-behavior:
      // smooth, so the default would animate the page there every frame.
      window.scrollTo({ top: saved.scrollY, behavior: "instant" });
      frame = window.requestAnimationFrame(tick);
    };

    const passive = { passive: true } as const;
    window.addEventListener("wheel", takeOver, passive);
    window.addEventListener("touchstart", takeOver, passive);
    window.addEventListener("pointerdown", takeOver, passive);
    window.addEventListener("keydown", takeOver);

    frame = window.requestAnimationFrame(tick);
    return stop;
  }, []);

  const list = useMemo(
    () =>
      products.filter((product) => {
        if ((product.gameModeSlug ?? "survival-smp") !== activeMode) return false;
        const inCategory =
          active === STORE_ALL_VIEW ||
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

  /** Canonical href for a view of this store, in the current game mode. */
  function viewHref(view: StoreView, nextSubfilter: string | null = null) {
    return buildStoreHref({ mode: activeMode, defaultMode, category: view, sub: nextSubfilter });
  }

  function rememberStorePosition() {
    window.sessionStorage.setItem(STORE_RETURN_KEY, JSON.stringify({
      scrollY: window.scrollY,
      savedAt: Date.now(),
    }));
    // Lets the detail page use the cached history entry instead of requesting
    // the dynamic Store route again. The marker is consumed by Back.
    window.sessionStorage.setItem(STORE_DETAIL_FROM_STORE_KEY, "1");
  }

  /*
    Following a link inside a menu when it does not change the view — "All
    Cosmetics" while already on Cosmetics — produces no navigation for the
    effect above to react to, so that one case closes the menu directly.
  */
  function closeMenu(event: MouseEvent<HTMLElement>) {
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
              <Link
                key={mode.slug}
                href={buildStoreHref({ mode: mode.slug, defaultMode })}
                scroll={false}
                className={cn("store-mode-tab", activeMode === mode.slug && "is-active")}
                aria-current={activeMode === mode.slug ? "true" : undefined}
              >
                <span className="store-mode-tab-icon"><Icon name={mode.icon || "Gamepad2"} size={15} /></span>
                <span>
                  <strong>{getModeDisplayName(mode)}</strong>
                  <small>{mode.tagline || (isLive ? "Store live" : "Coming soon")}</small>
                </span>
                <i className={isLive ? "is-live" : ""} aria-hidden="true" />
              </Link>
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
      <nav ref={navRef} className="store-shop-nav" aria-label={`${getModeDisplayName(selectedMode) || "Game mode"} store categories`}>
        <div className="store-shop-nav-main">
          <Link href={viewHref(STORE_ALL_VIEW)} scroll={false} className={cn("store-shop-nav-item", active === STORE_ALL_VIEW && "is-active")} aria-current={active === STORE_ALL_VIEW ? "page" : undefined}>
            <House size={15} /> Store Home
          </Link>

          {activeCategories.map((config) => config.useSubcategories ? (
            <details key={config.key} className={cn("store-shop-menu", active === config.key && "is-active")}>
              <summary className="store-shop-nav-item">{config.label} <ChevronDown size={14} /></summary>
              <div className="store-shop-submenu">
                <Link
                  href={viewHref(config.key)}
                  scroll={false}
                  onClick={closeMenu}
                  aria-current={active === config.key && !subfilter ? "page" : undefined}
                >
                  All {config.label}
                </Link>
                {config.subcategories.filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                  <Link
                    key={item.key}
                    href={viewHref(config.key, item.key)}
                    scroll={false}
                    onClick={closeMenu}
                    aria-current={active === config.key && subfilter === item.key ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : (
            <Link key={config.key} href={viewHref(config.key)} scroll={false} className={cn("store-shop-nav-item", active === config.key && "is-active")} aria-current={active === config.key ? "page" : undefined}>
              {config.label}
            </Link>
          ))}
        </div>
      </nav>

      {active === STORE_ALL_VIEW ? (
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
          <Link href={viewHref(STORE_ALL_VIEW)} scroll={false} className="btn btn-ghost btn-sm mt-5">
            Reset filters
          </Link>
        </div>
      )}
        </>
      )}
    </div>
  );
}
