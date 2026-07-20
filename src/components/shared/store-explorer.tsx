"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Clock3, Gamepad2, House, MessageCircle, PackageCheck, PackageSearch, ShoppingCart, Sparkles } from "lucide-react";
import type { GameMode, Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { RankOfferCard } from "./rank-offer-card";
import { cn } from "@/lib/utils";
import { storeCategoryDetails } from "@/lib/store-art";
import { site } from "@/lib/site";
import { readStoreReturnState, STORE_RETURN_KEY, STORE_RETURN_PENDING_KEY } from "@/lib/store-navigation";

type StoreView = Product["category"] | "All" | "Cosmetics";

const checkoutSteps = [
  { icon: ShoppingCart, step: "01", title: "Build your cart" },
  { icon: MessageCircle, step: "02", title: "Send to staff" },
  { icon: PackageCheck, step: "03", title: "Get your items" },
] as const;

export function StoreExplorer({ products, modes }: { products: Product[]; modes: GameMode[] }) {
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))),
    [products],
  );
  const [activeMode, setActiveMode] = useState("survival-smp");
  const [active, setActive] = useState<StoreView>("All");
  const [subfilter, setSubfilter] = useState<string | null>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem(STORE_RETURN_PENDING_KEY) !== "1") return;
    window.sessionStorage.removeItem(STORE_RETURN_PENDING_KEY);
    const saved = readStoreReturnState();
    if (!saved) return;

    setActiveMode(saved.activeMode);
    setActive(saved.active as StoreView);
    setSubfilter(saved.subfilter);

    const restoreScroll = () => window.scrollTo({ top: saved.scrollY, behavior: "instant" });
    window.requestAnimationFrame(() => window.requestAnimationFrame(restoreScroll));
    window.setTimeout(restoreScroll, 300);
    window.setTimeout(restoreScroll, 900);
    window.setTimeout(restoreScroll, 1600);
  }, []);

  const list = useMemo(
    () =>
      products.filter((product) => {
        const inCategory =
          active === "All" ||
          (active === "Cosmetics" ? product.category === "Battlepass" : product.category === active);
        const inSubcategory =
          !subfilter ||
          (active === "Ranks" && product.billing === subfilter) ||
          (active === "Add-ons" && product.subcategory === subfilter) ||
          (active === "Cosmetics" && subfilter === "Battlepass" && product.category === "Battlepass");
        return inCategory && inSubcategory;
      }),
    [products, active, subfilter],
  );
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

  const newArrivalSlugs = ["battlepass-premium", "key-legendary-1", "rank-conqueror-permanent"];
  const newArrivals = newArrivalSlugs.flatMap(
    (slug) => products.find((product) => product.slug === slug) ?? [],
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
        <div className="store-catalog-side">
          <p className="store-catalog-count telemetry">
            <Sparkles size={14} /> {displayCount(list)} {displayCount(list) === 1 ? "item" : "items"}
          </p>
          <aside className="store-checkout-guide" aria-labelledby="store-checkout-guide-title">
            <p className="eyebrow">Simple and personal</p>
            <h3 id="store-checkout-guide-title">From cart to your account</h3>
            <ol>
              {checkoutSteps.map(({ icon: Icon, step, title }) => (
                <li key={step}>
                  <span><Icon size={14} /></span>
                  <strong>{title}</strong>
                  <small className="telemetry">{step}</small>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>

      <nav className="store-shop-nav" aria-label="Survival store categories">
        <div className="store-shop-nav-main">
          <button
            type="button"
            onClick={() => chooseView("All")}
            className={cn("store-shop-nav-item", active === "All" && "is-active")}
            aria-pressed={active === "All"}
          >
            <House size={15} /> Store Home
          </button>

          <details className={cn("store-shop-menu", active === "Ranks" && "is-active")}>
            <summary className="store-shop-nav-item">
              Ranks <ChevronDown size={14} />
            </summary>
            <div className="store-shop-submenu">
              <button type="button" onClick={(event) => chooseFromMenu(event, "Ranks", "Monthly")}>Monthly Ranks</button>
              <button type="button" onClick={(event) => chooseFromMenu(event, "Ranks", "Permanent")}>Permanent Ranks</button>
            </div>
          </details>

          <button
            type="button"
            onClick={() => chooseView("Crate Keys")}
            className={cn("store-shop-nav-item", active === "Crate Keys" && "is-active")}
            aria-pressed={active === "Crate Keys"}
          >
            Crate Keys
          </button>

          <details className={cn("store-shop-menu", active === "Cosmetics" && "is-active")}>
            <summary className="store-shop-nav-item">
              Cosmetics <ChevronDown size={14} />
            </summary>
            <div className="store-shop-submenu">
              <button type="button" onClick={(event) => chooseFromMenu(event, "Cosmetics", "Battlepass")}>Battlepass</button>
              <button type="button" disabled>Weapon Bundles <small>Soon</small></button>
              <button type="button" disabled>Weapons <small>Soon</small></button>
              <button type="button" disabled>Custom Pets <small>Soon</small></button>
            </div>
          </details>

          <details className={cn("store-shop-menu", active === "Add-ons" && "is-active")}>
            <summary className="store-shop-nav-item">
              Add-ons <ChevronDown size={14} />
            </summary>
            <div className="store-shop-submenu">
              <button type="button" onClick={(event) => chooseFromMenu(event, "Add-ons")}>All Add-ons</button>
              <button type="button" onClick={(event) => chooseFromMenu(event, "Add-ons", "XP Boosts")}>XP Boosts</button>
              <button type="button" onClick={(event) => chooseFromMenu(event, "Add-ons", "Claim Blocks")}>Claim Blocks</button>
              <button type="button" onClick={(event) => chooseFromMenu(event, "Add-ons", "Player Points")}>Player Points</button>
            </div>
          </details>
        </div>
      </nav>

      {active === "All" ? (
        <div className="store-home-view">
          <section className="store-home-welcome" aria-labelledby="store-welcome-title">
            <div className="store-home-welcome-copy">
              <p className="eyebrow">Welcome to Mazora Network</p>
              <h3 id="store-welcome-title">Where Survival is only the beginning.</h3>
              <p>
                Step into a handcrafted Survival RPG shaped by ancient dungeons, custom bosses, deep skills,
                unique enchantments, collectible weapon skins, and a balanced player economy.
              </p>
              <div className="store-home-feature-list" aria-label="Survival features">
                <span>Custom bosses</span>
                <span>Dungeons</span>
                <span>Skills &amp; enchants</span>
                <span>Player economy</span>
              </div>
            </div>
            <aside className="store-home-server-card" aria-label="Server connection details">
              <p className="eyebrow">Ready to join?</p>
              <dl>
                <div><dt>Server IP</dt><dd>{site.javaIp}</dd></div>
                <div><dt>Version</dt><dd>{site.version}</dd></div>
                <div><dt>Platforms</dt><dd>Java + Bedrock</dd></div>
              </dl>
              <Link href="/play">How to join <ArrowRight size={14} /></Link>
            </aside>
          </section>

          <section className="store-home-update" aria-labelledby="store-update-title">
            <div className="store-home-update-mark"><Sparkles size={20} /></div>
            <div>
              <p className="eyebrow">What&apos;s new</p>
              <h3 id="store-update-title">The Survival Battlepass is live.</h3>
              <p>Complete daily missions with <strong>/battlepass</strong> or <strong>/bp</strong>, earn free-track rewards, and unlock the premium reward path when you are ready.</p>
            </div>
            <Link href="/store/battlepass-premium">View Battlepass <ArrowRight size={14} /></Link>
          </section>

          <section className="store-home-new" aria-labelledby="store-featured-title">
            <div className="store-home-section-head">
              <div>
                <p className="eyebrow">Popular right now</p>
                <h3 id="store-featured-title">Featured picks</h3>
                <p>Start with the newest and most useful Survival upgrades.</p>
              </div>
              <span className="telemetry"><Sparkles size={13} /> Updated picks</span>
            </div>
            <div className="store-product-deck" data-count={newArrivals.length}>
              {newArrivals.map((product) => (
                <ProductCard key={product.slug} product={product} onOpenDetails={rememberStorePosition} />
              ))}
            </div>
          </section>

          <section className="store-home-browse" aria-labelledby="store-browse-title">
            <div className="store-home-section-head">
              <div>
                <p className="eyebrow">Find your upgrade</p>
                <h3 id="store-browse-title">Shop by category</h3>
                <p>Choose what you need without scrolling through the entire catalog.</p>
              </div>
            </div>

            <div className="store-home-category-grid">
              <article className="store-home-category-card">
                <span className="telemetry">01</span>
                <h4>Ranks</h4>
                <p>Choose recurring support or keep your rank permanently.</p>
                <div>
                  <button type="button" onClick={() => chooseView("Ranks", "Monthly")}>Monthly</button>
                  <button type="button" onClick={() => chooseView("Ranks", "Permanent")}>Permanent</button>
                </div>
              </article>

              <article className="store-home-category-card">
                <span className="telemetry">02</span>
                <h4>Crate Keys</h4>
                <p>Open Survival crates with reward pools for every budget.</p>
                <button type="button" onClick={() => chooseView("Crate Keys")} className="store-home-category-action">
                  Browse keys <ArrowRight size={14} />
                </button>
              </article>

              <article className="store-home-category-card">
                <span className="telemetry">03</span>
                <h4>Cosmetics</h4>
                <p>Explore Battlepass rewards and upcoming collectible items.</p>
                <button type="button" onClick={() => chooseView("Cosmetics", "Battlepass")} className="store-home-category-action">
                  View cosmetics <ArrowRight size={14} />
                </button>
              </article>

              <article className="store-home-category-card">
                <span className="telemetry">04</span>
                <h4>Add-ons</h4>
                <p>Progress faster with XP, Claim Blocks, and Player Points.</p>
                <button type="button" onClick={() => chooseView("Add-ons")} className="store-home-category-action">
                  Browse add-ons <ArrowRight size={14} />
                </button>
              </article>
            </div>
          </section>

          <section className="store-home-coming" aria-label="Coming next">
            <div>
              <p className="eyebrow">In development</p>
              <h3>Coming next</h3>
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
