"use client";

import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { storeArtFor } from "@/lib/store-art";
import { usd } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { TonePill } from "@/components/ui";
import { StoreArtwork } from "./store-artwork";

export function ProductCard({ product, onOpenDetails }: { product: Product; onOpenDetails?: () => void }) {
  const { add, openCart } = useCart();
  const onSale = product.salePrice != null;
  const currentPrice = product.salePrice ?? product.price;
  const discount = onSale ? Math.round((1 - currentPrice / product.price) * 100) : 0;
  
  /*
    Where the product's name goes: over the artwork, or under it.

    The artwork decides. Cosmetics renders are supplied with the name already
    set into the image — "OPULENT KIT", "RABBIT PET" — so a caption on top of
    them prints the name twice. Everything else is a plain object on a
    background and needs the name added.

    This used to be the opposite way round: a list of the categories that DO get
    the overlay, naming "Crate Keys", "Battlepass" and three Add-ons
    subcategories. Two problems with that. Ranks was never on it, so a rank in
    the featured row sat next to a battlepass and a key with its title in a
    different place — the reason this changed. And the list is written in
    category labels, which staff rename and create freely in the admin, so a new
    category silently got the wrong treatment and renaming "Crate Keys" would
    have quietly moved its titles.

    Inverted, the default is the one that suits art with no text in it, which is
    what a newly uploaded image almost always is. The exception stays a short
    list of the ranges whose art is drawn with its own lettering.
  */
  const artworkCarriesItsOwnTitle = product.category === "Cosmetics";
  const isOverlaid = !artworkCarriesItsOwnTitle;

  function addProduct() {
    add(product);
    openCart();
  }

  return (
    <article className="store-product-card group" data-accent={product.accent} data-category={product.category} data-subcategory={product.subcategory}>
      <Link href={`/store/${product.slug}`} onClick={onOpenDetails} className="store-product-media" aria-label={`View ${product.name} details`}>
        <StoreArtwork
          src={storeArtFor(product)}
          alt={`${product.name} product artwork`}
          sizes="(max-width: 640px) calc(100vw - 3rem), (max-width: 1024px) 45vw, 30vw"
          imageClassName="transition duration-500 ease-out group-hover:scale-[1.045]"
        />
        <span className="store-product-media-shade" aria-hidden="true" />
        <span className="store-product-view">
          View details <ArrowUpRight size={13} />
        </span>
        <span className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.badge && <TonePill tone={product.accent}>{product.badge}</TonePill>}
          {onSale && (
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 backdrop-blur-md">
              Save {discount}%
            </span>
          )}
        </span>
        {isOverlaid && (
          <div className="store-product-media-title">
            {/*
              No colour utility here on purpose. This caption sits on the product
              artwork, which is dark under both site themes, so its colour cannot
              come from a theme token — `text-accent-bright` resolves to a dark
              purple in light theme and disappeared into the render. The
              marketplace also re-asserts that token at high specificity, so a
              stylesheet override turns into an arms race. The colour belongs to
              .store-product-media-title span, which owns it outright.
            */}
            <span>
              {product.subcategory ?? product.category}
            </span>
            <h3>
              {product.name}
            </h3>
          </div>
        )}
      </Link>
 
      <div className="store-product-body flex flex-1 flex-col p-4">
        {!isOverlaid && (
          <>
            <span className="store-product-kicker text-[10px] font-bold uppercase tracking-[0.18em] text-accent-bright">
              {product.category}
            </span>
            <Link href={`/store/${product.slug}`} onClick={onOpenDetails} className="mt-1.5">
              <h3 className="font-display text-lg font-extrabold tracking-tight transition group-hover:text-accent-bright">
                {product.name}
              </h3>
            </Link>
          </>
        )}
        <p className={isOverlaid ? "line-clamp-2 flex-1 text-[13px] leading-relaxed text-muted" : "mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-muted"}>
          {product.description}
        </p>

        <div className="store-product-price mt-4 flex items-center justify-between gap-3 border-t border-line/70 pt-3.5">
          <div>
            <span className="store-product-currency block text-[9px] font-bold uppercase tracking-widest text-muted">Price</span>
            <div className="telemetry mt-0.5 flex items-baseline gap-1.5">
              <span className="store-product-amount text-xl font-extrabold text-ink">{usd(currentPrice)}</span>
              <span className="text-[10px] font-semibold text-muted uppercase">USD</span>
              {onSale && <span className="text-xs text-muted/60 line-through ml-1">{usd(product.price)}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={addProduct}
            className="store-add-button"
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus size={15} />
            <span>Add</span>
          </button>
        </div>
      </div>
    </article>
  );
}
