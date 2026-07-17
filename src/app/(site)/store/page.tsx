import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowDown,
  CheckCircle2,
  Gamepad2,
  Headphones,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Zap,
} from "lucide-react";
import { getGameModes, getProducts } from "@/lib/data/content";
import { Reveal } from "@/components/shared";
import { CartTrigger } from "@/components/shared/cart-trigger";
import { StoreExplorer } from "@/components/shared/store-explorer";
import { CartPageLauncher } from "@/components/shared/cart-page-launcher";
import { FeaturedDrops } from "@/components/shared/featured-drops";

export const metadata: Metadata = {
  title: "Store",
  description: "Survival ranks, crate keys, battlepass upgrades and progression add-ons for the Mazora Network.",
};

const orderSteps = [
  {
    icon: ShoppingCart,
    step: "01",
    title: "Build your cart",
    body: "Pick your upgrades and review everything in the slide-over cart.",
  },
  {
    icon: MessageCircle,
    step: "02",
    title: "Send to staff",
    body: "Your private request arrives in the Mazora staff order channel.",
  },
  {
    icon: PackageCheck,
    step: "03",
    title: "Get your items",
    body: "Staff confirms payment and delivers your rewards in-game.",
  },
];

const benefits = [
  { icon: ShieldCheck, title: "Fair-play promise", body: "Cosmetic and convenience rewards — never unfair power." },
  { icon: Gamepad2, title: "Network-wide", body: "Rewards built for your Mazora adventures." },
  { icon: Headphones, title: "Human support", body: "Every order is checked by a real staff member." },
  { icon: Zap, title: "Quick fulfilment", body: "Staff delivers as soon as payment is confirmed." },
];

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ cart?: string }>;
}) {
  const [products, modes, params] = await Promise.all([getProducts(), getGameModes(), searchParams]);
  const featuredSlugs = ["rank-conqueror-permanent", "battlepass-premium", "key-legendary-1", "rank-immortal-permanent"];
  const featuredDrops = featuredSlugs.flatMap((slug) => products.find((product) => product.slug === slug) ?? []);
  const drops = featuredDrops.length > 0 ? featuredDrops : products.slice(0, 3);
  const itemCount = new Set(products.map((product) => product.family ?? product.slug)).size;

  return (
    <>
      <CartPageLauncher
        enabled={params.cart === "open" || params.cart === "request"}
        step={params.cart === "request" ? "details" : "cart"}
      />
      <section className="store-hero">
        <Image
          src="/images/store/shop-world-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="store-hero-overlay" aria-hidden="true" />
        <div className="store-hero-grid" aria-hidden="true" />

        <div className="shell store-hero-stage relative z-10">
          <div className="store-hero-status">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-100 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#4ade80]" />
              Manual ordering is open
            </div>
            <span className="telemetry hidden text-[10px] uppercase tracking-[0.22em] text-white/40 sm:block">
              Mazora / Marketplace
            </span>
          </div>

          <div className="store-hero-title">
            <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.34em] text-violet-100/80 sm:text-xs">
              <Sparkles size={14} /> The Mazora marketplace
            </p>
            <h1 className="mt-3 text-[clamp(5rem,14vw,11rem)] font-black leading-[0.76] tracking-[-0.075em] text-white">
              SHOP
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed sm:text-base" style={{ color: "rgba(255, 255, 255, 0.72)" }}>
              Survival ranks, crate keys, battlepass upgrades and add-ons built for your next Mazora chapter.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#catalog" className="btn btn-primary h-12 px-5">
                Explore the store <ArrowDown size={16} />
              </a>
              <CartTrigger
                label="Open cart"
                className="h-12 border-white/20 bg-white/10 px-5 text-white shadow-none hover:border-violet-300/45 hover:bg-white/15 hover:text-white"
              />
            </div>
          </div>

          <FeaturedDrops drops={drops} />

          <div className="store-hero-trust">
            <span><CheckCircle2 size={13} /> No online payment</span>
            <span><CheckCircle2 size={13} /> Staff-verified delivery</span>
            <span><CheckCircle2 size={13} /> {itemCount} Survival items</span>
          </div>
        </div>
      </section>

      <div className="store-marketplace">
        <section className="store-benefits" aria-label="Why shop with Mazora">
          <div className="store-benefits-intro shell">
            <p className="eyebrow">Enter the marketplace</p>
            <h2>Your Survival journey starts here.</h2>
          </div>
          <div className="store-benefits-grid shell">
            {benefits.map(({ icon: Icon, title, body }) => (
              <div key={title} className="store-benefit-card">
                <span className="store-benefit-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      <section className="section shell store-catalog-shell">
        <Reveal>
          <StoreExplorer products={products} modes={modes} />
        </Reveal>

        <Reveal className="store-order-guide mt-14">
          <div className="max-w-xl">
            <p className="eyebrow">Simple and personal</p>
            <h2 className="mt-2 text-3xl font-extrabold">From cart to your account</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We are keeping checkout human while payments are being prepared. You stay in control and never enter payment
              details on this website.
            </p>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {orderSteps.map(({ icon: Icon, step, title, body }) => (
              <div key={step} className="store-order-step">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent-bright">
                    <Icon size={18} />
                  </span>
                  <span className="telemetry text-[10px] font-bold tracking-[0.18em] text-muted">{step}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
      </div>
    </>
  );
}
