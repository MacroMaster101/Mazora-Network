"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Star } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { storeArtFor } from "@/lib/store-art";
import { usd } from "@/lib/utils";
import { StoreArtwork } from "./store-artwork";

const ROTATE_MS = 6000;

function headlineFor(drop: Product): string {
  if (drop.category === "Ranks") return `The ${drop.family ?? drop.name} rank is live.`;
  if (drop.category === "Battlepass") return "Season rewards, unlocked.";
  if (drop.category === "Crate Keys") return "Rare loot is waiting.";
  return "Boost your next chapter.";
}

/** Rotating "Featured drop" card for the store hero. Auto-advances, pauses on
 *  hover/focus, and stays put for visitors who prefer reduced motion. */
export function FeaturedDrops({ drops }: { drops: Product[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = drops.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  if (count === 0) return null;
  const drop = drops[Math.min(index, count - 1)];
  const price = drop.salePrice ?? drop.price;

  return (
    <div
      className="store-hero-offer"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured drops"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={drop.slug}
          className="store-hero-offer-inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="store-hero-offer-copy">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
              <Star size={13} fill="currentColor" /> Featured drop
              {count > 1 && (
                <span className="telemetry text-white/35" aria-hidden="true">
                  0{index + 1} / 0{count}
                </span>
              )}
            </div>
            <h2 className="mt-3 max-w-[15ch] text-2xl font-black leading-[1.02] tracking-tight sm:text-3xl">
              {headlineFor(drop)}
            </h2>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-white/50 sm:text-sm">{drop.description}</p>
          </div>

          <div className="store-hero-offer-art">
            <StoreArtwork
              src={storeArtFor(drop)}
              alt=""
              sizes="(max-width: 599px) 38vw, (max-width: 900px) 34vw, 26vw"
            />
            <span aria-hidden="true" />
          </div>

          <div className="store-hero-offer-action">
            <BadgePercent size={18} className="text-violet-200" />
            <div>
              <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
                {drop.badge ?? drop.category} · USD
              </span>
              <strong className="telemetry mt-1 block text-lg text-white">{usd(price)}</strong>
            </div>
            <a href={`/store/${drop.slug}`} className="btn btn-primary btn-sm ml-auto">
              {drop.category === "Ranks" ? "View rank" : "View item"}
            </a>
          </div>
        </motion.div>
      </AnimatePresence>

      {count > 1 && (
        <div className="store-hero-offer-dots" role="tablist" aria-label="Choose featured drop">
          {drops.map((d, i) => (
            <button
              key={d.slug}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show drop ${i + 1}: ${d.name}`}
              className={i === index ? "is-active" : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
