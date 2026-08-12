"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { GalleryImage } from "@/lib/types";
import { FloatingBrandLogo, PageHero, Reveal } from "@/components/shared";
import { GalleryGrid } from "./gallery-grid";
import { GallerySubmitModal } from "./gallery-submit-modal";

export function GalleryPageClient({
  images,
  isLoggedIn = false,
  accountName = "",
}: {
  images: GalleryImage[];
  isLoggedIn?: boolean;
  accountName?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="Have a peek at what our community is up to!"
        lead="Player builds, events, and community moments and more! Click on the image to view it in full-size."
        illustration={<FloatingBrandLogo />}
      >
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn btn-primary py-3 px-5 text-sm font-semibold flex items-center gap-2.5 rounded-xl shadow-lg shadow-accent/25 hover:shadow-accent/45 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Sparkles size={18} /> Submit Artwork
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold text-accent-bright backdrop-blur-md">
            <Sparkles size={13} /> Share your builds with the Mazora community
          </span>
        </div>
      </PageHero>

      <section className="section shell gallery-section">
        <Reveal>
          <GalleryGrid images={images} />
        </Reveal>
      </section>

      <GallerySubmitModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isLoggedIn={isLoggedIn}
        accountName={accountName}
      />
    </>
  );
}
