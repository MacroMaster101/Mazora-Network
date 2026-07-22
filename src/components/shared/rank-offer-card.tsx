"use client";

import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { storeArtFor } from "@/lib/store-art";
import { usd } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { StoreArtwork } from "./store-artwork";

export function RankOfferCard({
  family,
  products,
  onOpenDetails,
}: {
  family: string;
  products: Product[];
  onOpenDetails?: () => void;
}) {
  const { add, openCart } = useCart();
  const monthly = products.find((product) => product.billing === "Monthly");
  const permanent = products.find((product) => product.billing === "Permanent");
  const accent = permanent?.accent ?? monthly?.accent ?? "violet";

  function addRank(product: Product) {
    add(product);
    openCart();
  }

  return (
    <article className="store-rank-card" data-accent={accent}>
      <div className="store-rank-card-media relative overflow-hidden group">
        <div className="store-rank-medallion-container absolute inset-0">
          <StoreArtwork
            src={storeArtFor(permanent ?? monthly ?? products[0])}
            alt={`${family} medallion`}
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
            imageClassName="transition duration-500 ease-out group-hover:scale-[1.06]"
          />
        </div>
        <span aria-hidden="true" />
        <div>
          <p>Survival rank</p>
          <h4>{family}</h4>
        </div>
      </div>

      <div className="store-rank-options">
        {[monthly, permanent].filter(Boolean).map((product) => (
          <div key={product!.slug} className="store-rank-option">
            <Link href={`/store/${product!.slug}`} onClick={onOpenDetails} className="min-w-0 flex-1">
              <span>{product!.billing}</span>
              <strong>
                {usd(product!.price)}
                <small className="ml-1 uppercase text-muted font-bold text-[10px]">USD</small>
              </strong>
            </Link>
            <Link
              href={`/store/${product!.slug}`}
              onClick={onOpenDetails}
              className="store-rank-details"
              aria-label={`View ${product!.name} details`}
            >
              <ArrowUpRight size={14} />
            </Link>
            <button
              type="button"
              onClick={() => addRank(product!)}
              className="store-rank-add"
              aria-label={`Add ${product!.name} to cart`}
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}
