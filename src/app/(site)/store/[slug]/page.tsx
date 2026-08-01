import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { getProduct } from "@/lib/data/content";
import { storeArtFor } from "@/lib/store-art";
import { usd } from "@/lib/utils";
import { Reveal } from "@/components/shared";
import { TonePill } from "@/components/ui";
import { AddToCartButton } from "@/components/shared/add-to-cart";
import { StoreBackButton } from "@/components/shared/store-back-button";
import { StoreArtwork } from "@/components/shared/store-artwork";

/**
 * Rendered per request rather than prerendered from generateStaticParams.
 *
 * Prerendering made `notFound()` return HTTP 200 with the 404 body — a soft 404
 * that search engines index as a real page — and it also meant a product added
 * in the admin only appeared after a rebuild. The catalogue lives in the
 * database, so per-request rendering is both correct and current; server TTFB
 * for these pages is a few tens of milliseconds.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found" };
  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const onSale = product.salePrice != null;
  const currentPrice = product.salePrice ?? product.price;

  return (
    <section className="store-detail-page">
      <div className="section shell pt-28">
        <StoreBackButton />

      <div className="store-detail-layout grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)] lg:items-start lg:gap-12">
        <Reveal className="store-detail-media" data-accent={product.accent}>
          <StoreArtwork
            src={storeArtFor(product)}
            alt={`${product.name} product artwork`}
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
          />
          <span className="store-detail-media-glow" aria-hidden="true" />
          <span className="absolute left-5 top-5 flex gap-2">
            {product.badge && <TonePill tone={product.accent}>{product.badge}</TonePill>}
            <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/75 backdrop-blur-md">
              Digital item
            </span>
          </span>
          <span className="store-detail-media-caption">
            <small>{product.subcategory ?? product.category}</small>
            <strong>{product.name}</strong>
          </span>
        </Reveal>

        <Reveal delay={0.05} className="store-detail-panel flex flex-col justify-center">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-bright">
            <Sparkles size={14} /> {product.category}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">{product.name}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">{product.description}</p>

          <div className="store-detail-price mt-7 flex items-end gap-3 border-y py-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Price</span>
              <div className="telemetry mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-black">{usd(currentPrice)}</span>
                <span className="text-sm font-semibold text-muted uppercase">USD</span>
                {onSale && <span className="text-lg text-muted line-through ml-2">{usd(product.price)}</span>}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-bold">What&apos;s included</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {product.features.map((feature) => (
                <li key={feature} className="store-detail-feature flex items-start gap-2.5 rounded-xl p-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-bright">
                    <Check size={12} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7">
            <AddToCartButton product={product} />
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <div className="store-detail-assurance flex items-center gap-3 rounded-xl border p-3">
              <ShieldCheck size={17} className="text-success" />
              <span className="text-xs">
                <strong className="block">Staff verified</strong>
                <span className="text-muted">Manual secure request</span>
              </span>
            </div>
            <div className="store-detail-assurance flex items-center gap-3 rounded-xl border p-3">
              <Clock3 size={17} className="text-accent-bright" />
              <span className="text-xs">
                <strong className="block">Quick delivery</strong>
                <span className="text-muted">After payment confirmation</span>
              </span>
            </div>
          </div>
        </Reveal>
      </div>
      </div>
    </section>
  );
}
