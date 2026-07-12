import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { getProduct, getProducts } from "@/lib/data/content";
import { usd } from "@/lib/utils";
import { CoverArt, Reveal } from "@/components/shared";
import { TonePill } from "@/components/ui";
import { AddToCartButton } from "@/components/shared/add-to-cart";

const categoryIcon: Record<string, string> = {
  Ranks: "Crown",
  Cosmetics: "Sparkles",
  Coins: "Coins",
  "Crate Keys": "Gift",
  Bundles: "Layers",
};

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

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

  return (
    <section className="section shell">
      <Link href="/store" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to store
      </Link>
      <div className="grid gap-8 lg:grid-cols-2">
        <Reveal className="panel overflow-hidden">
          <CoverArt accent={product.accent} icon={categoryIcon[product.category]} height="h-72" />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted">{product.category}</span>
            {product.badge && <TonePill tone={product.accent}>{product.badge}</TonePill>}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-muted">{product.description}</p>

          <div className="telemetry mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{usd(product.salePrice ?? product.price)}</span>
            {onSale && <span className="text-lg text-muted line-through">{usd(product.price)}</span>}
          </div>

          <ul className="mt-6 space-y-2">
            {product.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check size={17} className="mt-0.5 shrink-0 text-accent-bright" /> {f}
              </li>
            ))}
          </ul>

          <div className="mt-7">
            <AddToCartButton product={product} />
          </div>

          <p className="mt-5 text-xs text-muted">
            Digital goods are delivered to your linked Minecraft account. All purchases are subject to the store terms; no
            payment is processed in this preview build.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
