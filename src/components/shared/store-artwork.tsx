"use client";

import { useState } from "react";
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

const FALLBACK_ART = "/images/store/battlepass-pass.webp";

/** A consistent, crop-safe frame for built-in and admin-uploaded store art. */
export function StoreArtwork({
  src,
  alt,
  sizes,
  priority = false,
  className,
  imageClassName,
}: StoreArtworkProps) {
  // Normalize png to webp for local store images
  const initialSrc =
    src && src.startsWith("/images/store/") && src.endsWith(".png")
      ? src.replace(/\.png$/, ".webp")
      : src || FALLBACK_ART;

  const [imgSrc, setImgSrc] = useState(initialSrc);

  return (
    <span className={cn("store-artwork-frame", className)}>
      <Image
        src={imgSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={90}
        className={cn("store-artwork-image", imageClassName)}
        onError={() => {
          if (imgSrc.endsWith(".png")) {
            setImgSrc(imgSrc.replace(/\.png$/, ".webp"));
          } else if (imgSrc !== FALLBACK_ART) {
            setImgSrc(FALLBACK_ART);
          }
        }}
      />
    </span>
  );
}
