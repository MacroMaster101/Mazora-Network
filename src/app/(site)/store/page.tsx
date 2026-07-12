import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ShoppingCart } from "lucide-react";
import { getProducts } from "@/lib/data/content";
import { PageHero, Reveal } from "@/components/shared";
import { StoreExplorer } from "@/components/shared/store-explorer";

export const metadata: Metadata = {
  title: "Store",
  description: "Ranks, cosmetics, coins, crate keys and bundles that support the server — never pay-to-win.",
};

export default async function StorePage() {
  const products = await getProducts();
  return (
    <>
      <PageHero eyebrow="Support the network" title="Store" lead="Ranks, cosmetics and crate keys that keep the servers running. Everything here is cosmetic or convenience — never pay-to-win.">
        <Link href="/cart" className="btn btn-ghost btn-sm">
          <ShoppingCart size={15} /> View cart
        </Link>
      </PageHero>
      <section className="section shell">
        <Reveal className="glass mb-8 flex items-center gap-3 p-4">
          <ShieldCheck size={18} className="shrink-0 text-accent-bright" />
          <p className="text-sm text-muted">
            Payments aren&apos;t live yet — checkout is built to plug into a real provider later. You can browse and build a
            cart, but no charges are processed.
          </p>
        </Reveal>
        <Reveal>
          <StoreExplorer products={products} />
        </Reveal>
      </section>
    </>
  );
}
