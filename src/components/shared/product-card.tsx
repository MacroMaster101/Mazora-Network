"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { usd } from "@/lib/utils";
import { CoverArt } from "./cover-art";
import { useCart } from "./cart-provider";
import { useToast, TonePill } from "@/components/ui";

const categoryIcon: Record<Product["category"], string> = {
  Ranks: "Crown",
  Cosmetics: "Sparkles",
  Coins: "Coins",
  "Crate Keys": "Gift",
  Bundles: "Layers",
};

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { toast } = useToast();
  const onSale = product.salePrice != null;

  return (
    <div className="panel panel-hover group flex flex-col overflow-hidden">
      <Link href={`/store/${product.slug}`} className="relative block">
        <CoverArt accent={product.accent} icon={categoryIcon[product.category]} height="h-32" />
        {product.badge && (
          <span className="absolute left-3 top-3">
            <TonePill tone={product.accent}>{product.badge}</TonePill>
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <span className="text-xs uppercase tracking-widest text-muted">{product.category}</span>
        <Link href={`/store/${product.slug}`}>
          <h3 className="mt-1 font-display text-lg font-bold group-hover:text-accent-bright">{product.name}</h3>
        </Link>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted">{product.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="telemetry flex items-baseline gap-2">
            <span className="text-lg font-bold text-ink">{usd(product.salePrice ?? product.price)}</span>
            {onSale && <span className="text-sm text-muted line-through">{usd(product.price)}</span>}
          </div>
          <button
            onClick={() => {
              add(product);
              toast(`${product.name} added to cart`, "success");
            }}
            className="btn btn-primary btn-sm"
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus size={15} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
