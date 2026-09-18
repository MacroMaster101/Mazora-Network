import Image from "next/image";
import type { ForumPostImage } from "@/lib/data/forums";

/**
 * A post's attached images. Server-rendered and read-only: the images belong
 * to the post, and removing the post is what removes them.
 */
export function PostImages({ images }: { images: ForumPostImage[] }) {
  if (images.length === 0) return null;
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {images.map((image, index) => (
        <li key={image.id} className="overflow-hidden rounded-xl border border-line bg-surface">
          <a href={image.url} target="_blank" rel="noopener noreferrer" className="block">
            <Image
              src={image.url}
              alt={`Attached image ${index + 1}`}
              width={160}
              height={160}
              className="h-24 w-full object-cover sm:h-28"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
