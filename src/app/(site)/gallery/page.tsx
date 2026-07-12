import type { Metadata } from "next";
import { getGallery } from "@/lib/data/content";
import { PageHero, Reveal } from "@/components/shared";
import { GalleryGrid } from "@/components/shared/gallery-grid";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Screenshots of spawns, player builds, events and community moments from across the network.",
};

export default async function GalleryPage() {
  const images = await getGallery();
  return (
    <>
      <PageHero eyebrow="Screenshots" title="Look what the community built." lead="Spawns, player builds, events, and community moments. Tap any image to view it full-size." />
      <section className="section shell">
        <Reveal>
          <GalleryGrid images={images} />
        </Reveal>
      </section>
    </>
  );
}
