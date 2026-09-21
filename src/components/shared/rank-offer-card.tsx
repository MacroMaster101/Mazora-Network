"use client";

import Link from "@/components/ui/app-link";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { storeArtFor } from "@/lib/store-art";
import { usd } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { StoreArtwork } from "./store-artwork";
import { type PublicDiscountAlert, getBestDiscountAlert } from "@/lib/store-discount";

export function RankOfferCard({
  family,
  products,
  onOpenDetails,
  discountAlert,
  discountAlerts,
}: {
  family: string;
  products: Product[];
  onOpenDetails?: () => void;
  discountAlert?: PublicDiscountAlert | null;
  discountAlerts?: PublicDiscountAlert[] | null;
}) {
  const { add, openCart } = useCart();
  const monthly = products.find((product) => product.billing === "Monthly");
  const permanent = products.find((product) => product.billing === "Permanent");
  const accent = permanent?.accent ?? monthly?.accent ?? "violet";
  /*
    The variant the card is fronting: its medallion is the artwork, and its page
    is where the artwork should lead. Falls back through the list so a filtered
    view — /store?category=ranks&sub=monthly, where no permanent variant is in
    `products` — still fronts something real.
  */
  const featured = permanent ?? monthly ?? products[0];

  const topAlert =
    discountAlert ??
    products
      .map((p) => getBestDiscountAlert(discountAlerts, p.id))
      .filter((a): a is PublicDiscountAlert => a !== null)
      .sort((a, b) => b.percentOff - a.percentOff)[0] ??
    null;

  function addRank(product: Product) {
    add(product);
    openCart();
  }

  return (
    <article className="store-rank-card" data-accent={accent}>
      {/*
        A link, not a div. The medallion and the rank name are the biggest thing
        on the card and the obvious thing to click, and on rank cards they did
        nothing — every other product card opens its page from the artwork
        (see ProductCard). Reaching the page meant finding the small arrow in the
        row beneath.
      */}
      <Link
        href={`/store/${featured.slug}`}
        onClick={onOpenDetails}
        className="store-rank-card-media relative overflow-hidden group"
      >
        <div className="store-rank-medallion-container absolute inset-0">
          <StoreArtwork
            src={storeArtFor(featured)}
            alt={`${family} medallion`}
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
            imageClassName="transition duration-500 ease-out group-hover:scale-[1.06]"
          />
        </div>
        <span aria-hidden="true" />
        {topAlert && (
          <div className="!absolute right-3.5 top-3.5 z-10 pointer-events-none">
            <span
              className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-600/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md"
              title={`${topAlert.percentOff}% off with code ${topAlert.code}`}
            >
              🏷️ {topAlert.percentOff}% OFF
            </span>
          </div>
        )}
        <div>
          <p>Survival rank</p>
          <h4>{family}</h4>
        </div>
      </Link>

      <div className="store-rank-options">
        {[monthly, permanent].filter(Boolean).map((product) => {
          const alertForOption = discountAlert ?? getBestDiscountAlert(discountAlerts, product!.id);
          const isEligible = Boolean(
            alertForOption &&
              (alertForOption.isAllProducts ||
                alertForOption.productIds.length === 0 ||
                (product!.id && alertForOption.productIds.includes(product!.id))),
          );
          const discountedPrice = isEligible && alertForOption
            ? Math.max(Math.round(product!.price * (1 - alertForOption.percentOff / 100) * 100) / 100, 0)
            : null;

          return (
            <div key={product!.slug} className="store-rank-option">
              <Link href={`/store/${product!.slug}`} onClick={onOpenDetails} className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {product!.billing}
                  {isEligible && alertForOption && (
                    <span className="rounded bg-violet-600/90 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-white">
                      -{alertForOption.percentOff}%
                    </span>
                  )}
                </span>
                <strong>
                  {discountedPrice != null ? (
                    <>
                      <span className="text-violet-700 dark:text-accent-bright">{usd(discountedPrice)}</span>
                      <span className="ml-1 text-xs text-muted line-through">{usd(product!.price)}</span>
                    </>
                  ) : (
                    usd(product!.price)
                  )}
                  <small className="ml-1 uppercase text-muted font-bold text-[10px]">USD</small>
                </strong>
                {isEligible && alertForOption && (
                  <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                    with code {alertForOption.code}
                  </p>
                )}
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
          );
        })}
      </div>
    </article>
  );
}
