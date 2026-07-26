import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";
import { getGallery } from "@/lib/data/content";
import { EmptyState, PageHero, Reveal } from "@/components/shared";
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
          {images.length > 0 ? (
            <GalleryGrid images={images} />
          ) : (
            <EmptyState
              icon={<ImageIcon size={24} />}
              title="The gallery is empty"
              message="Screenshots of spawns, player builds and community moments will appear here once images are uploaded."
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
