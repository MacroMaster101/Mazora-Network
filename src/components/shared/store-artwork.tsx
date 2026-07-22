import Image from "next/image";
import { cn } from "@/lib/utils";

type StoreArtworkProps = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
};

/** A consistent, crop-safe frame for built-in and admin-uploaded store art. */
export function StoreArtwork({
  src,
  alt,
  sizes,
  priority = false,
  className,
  imageClassName,
}: StoreArtworkProps) {
  return (
    <span className={cn("store-artwork-frame", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={90}
        className={cn("store-artwork-image", imageClassName)}
      />
    </span>
  );
}
