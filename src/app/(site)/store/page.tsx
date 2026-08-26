import { publicPageMetadata } from "@/lib/seo";
import Image from "next/image";
import {
  ArrowDown,
  Layers3,
  PackageSearch,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { getGameModes, getProducts } from "@/lib/data/content";
import { getStoreFeaturedSlugs, getStoreRoadmap, getStoreWelcomeBanner } from "@/lib/data/store-settings";
import { getStoreCategoryConfigs } from "@/lib/data/store-categories";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { Reveal } from "@/components/shared";
import { CartTrigger } from "@/components/shared/cart-trigger";
import { StoreExplorer } from "@/components/shared/store-explorer";
import { CartPageLauncher } from "@/components/shared/cart-page-launcher";
import { cn } from "@/lib/utils";
// Import order mirrors the order these rules loaded in before they were split
// out of globals.css / responsive-store-vote.css. Do not reshuffle.
import "@/styles/store-pages.css";
import "@/styles/store-vote-responsive.css";
import "@/styles/store-header.css";

export const metadata = publicPageMetadata({
  title: "Store",
  description: "Survival ranks, crate keys, battlepass upgrades and progression add-ons for the Mazora Network.",
  path: "/store",
});

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ cart?: string }>;
}) {
  const [products, modes, params, featuredSlugs, welcomeBanner, roadmap, generalSettings] = await Promise.all([
    getProducts(),
    getGameModes(),
    searchParams,
    getStoreFeaturedSlugs(),
    getStoreWelcomeBanner(),
    getStoreRoadmap(),
    getSiteGeneralSettings(),
  ]);
  const categoryConfigs = await getStoreCategoryConfigs(modes);
  const offerCount = new Set(products.map((product) => product.family ?? product.slug)).size;
  const collectionCount = new Set(
    products.map((product) => (product.category === "Battlepass" ? "Cosmetics" : product.category)),
  ).size;

  return (
    <>
      <CartPageLauncher
        enabled={params.cart === "open" || params.cart === "request"}
        step={params.cart === "request" ? "details" : "cart"}
      />
      <section className="store-hero store-hero-v2">
        <Image
          src="/images/store/shop-world-bg-v2.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="store-hero-overlay" aria-hidden="true" />
        <div className="store-hero-grid" aria-hidden="true" />

        <div className="shell store-hero-stage store-hero-v2-stage relative z-10">
          <div className="store-hero-v2-status">
            <div className="store-hero-v2-live-pill">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  generalSettings.storeEnabled
                    ? "bg-emerald-400 shadow-[0_0_12px_#4ade80]"
                    : "bg-amber-400 shadow-[0_0_12px_#fbbf24]"
                )}
              />
              {generalSettings.storeEnabled ? "Marketplace open" : "Store checkouts paused"}
            </div>
          </div>

          <div className="store-hero-v2-mast">
            <div className="store-hero-v2-stat store-hero-v2-stat-left">
              <span>
                <PackageSearch size={16} aria-hidden="true" />
                <small>Store offers</small>
              </span>
              <strong>{offerCount.toLocaleString()}</strong>
            </div>

            <div className="store-hero-v2-brand">
              <span className="store-hero-v2-brand-aura" aria-hidden="true" />
              <Image
                src="/images/mazora-logo.webp"
                alt="Mazora Network"
                width={300}
                height={200}
                sizes="(max-width: 640px) 190px, 270px"
                className="store-hero-v2-logo animate-float"
              />
            </div>

            <div className="store-hero-v2-stat store-hero-v2-stat-right">
              <span>
                <Layers3 size={16} aria-hidden="true" />
                <small>Collections</small>
              </span>
              <strong>{collectionCount.toLocaleString()}</strong>
            </div>
          </div>

          <div className="store-hero-v2-copy">
            <h1>
              Your next chapter <span>starts here.</span>
            </h1>
            <p>
              Survival ranks, crate keys, battlepass upgrades and progression add-ons made for the Mazora experience.
            </p>

            {!generalSettings.storeEnabled && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200">
                <AlertTriangle size={14} className="text-amber-400" />
                Rank upgrades and checkout are temporarily paused for scheduled maintenance.
              </div>
            )}

            <div className="store-hero-v2-actions">
              <a href="#catalog" className="btn btn-primary h-12 px-5">
                Explore the store <ArrowDown size={16} />
              </a>
              <CartTrigger
                label="Open cart"
                className="store-hero-cart-trigger h-12 border-white/20 bg-white/10 px-5 text-white shadow-none hover:border-violet-300/45 hover:bg-white/15 hover:text-white"
              />
            </div>

            <div className="store-hero-v2-note" role="note" aria-label="Store payment notice">
              <ShieldCheck size={20} className="shrink-0 text-violet-400 dark:text-violet-300" aria-hidden="true" />
              <span>
                <strong>Manual, staff-verified ordering:</strong> No payment is taken on this website · Fulfillments are handled in Discord tickets.
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="store-marketplace">
        <section className="section shell store-catalog-shell">
          <Reveal>
            <StoreExplorer
              products={products}
              modes={modes}
              featuredSlugs={featuredSlugs}
              categoryConfigs={categoryConfigs}
              welcomeBanner={welcomeBanner}
              roadmap={roadmap}
            />
          </Reveal>
        </section>
      </div>
    </>
  );
}
