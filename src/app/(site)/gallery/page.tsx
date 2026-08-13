import { publicPageMetadata } from "@/lib/seo";
import { getSession, getSessionUserId } from "@/lib/auth";
import { getGallery } from "@/lib/data/content";
import { GalleryPageClient } from "@/components/shared/gallery-page-client";

export const metadata = publicPageMetadata({
  title: "Gallery",
  description: "Have a peek at what our community is up to! Player builds, events, and community moments and more! Click on the image to view it in full-size.",
  path: "/gallery",
});

export default async function GalleryPage() {
  const session = await getSession();
  const userId = await getSessionUserId();
  const images = await getGallery(userId);
  const isLoggedIn = Boolean(session);
  const accountName = session ? (session.displayName || session.username) : "";

  return (
    <GalleryPageClient
      images={images}
      isLoggedIn={isLoggedIn}
      accountName={accountName}
    />
  );
}
