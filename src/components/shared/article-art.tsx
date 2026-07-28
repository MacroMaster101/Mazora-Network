"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { NewsArticle } from "@/lib/types";
import { CoverArt } from "./cover-art";
import { cn } from "@/lib/utils";

const fallbackIcon: Record<string, string> = {
  Updates: "Sparkles",
  "Server Updates": "Sparkles",
  Announcements: "MessagesSquare",
  Events: "Trophy",
  Store: "Gift",
  "Patch Notes": "Swords",
  Community: "Users",
  Maintenance: "Cpu",
};

/**
 * An article's artwork, or the generated cover when it has none.
 *
 * Announcement graphics arrive at whatever ratio their author used — wide
 * banners, squares, the occasional portrait. Cropping them to fit sliced the
 * headline text off, so the real image is letterboxed and a blurred, cropped
 * copy fills the space behind it. Without that the odd-shaped ones sat in dead
 * bars and read as broken.
 */
export function ArticleArt({
  article,
  height,
  sizes,
  priority = false,
  hoverZoom = false,
  fit = "cover",
  className,
}: {
  article: Pick<NewsArticle, "featuredImage" | "accent" | "category">;
  height: string;
  sizes: string;
  priority?: boolean;
  hoverZoom?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [article.featuredImage]);

  if (!article.featuredImage || failed) {
    return (
      <CoverArt
        accent={article.accent}
        icon={fallbackIcon[article.category] ?? "Sparkles"}
        height={height}
        label={article.category}
        className={cn("news-fallback-cover", className)}
      />
    );
  }

  if (fit === "cover") {
    return (
      <span className={cn("news-art relative block overflow-hidden bg-base/60", height, className)}>
        <Image
          src={article.featuredImage}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
          className={cn(
            "object-cover object-center",
            hoverZoom && "transition-transform duration-700 ease-out group-hover:scale-[1.045]",
          )}
        />
        <span className="news-art-shade absolute inset-0" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={cn("news-art news-art-contain relative block overflow-hidden bg-base/60", height, className)}>
      <Image
        src={article.featuredImage}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        aria-hidden="true"
        onError={() => setFailed(true)}
        className="scale-110 object-cover object-center opacity-35 blur-2xl"
      />
      <span className="absolute inset-0 bg-black/20" aria-hidden="true" />
      <Image
        src={article.featuredImage}
        alt={`${article.category} article artwork`}
        fill
        sizes={sizes}
        priority={priority}
        onError={() => setFailed(true)}
        className={cn(
          "object-contain object-center p-2 sm:p-3",
          hoverZoom && "transition-transform duration-500 group-hover:scale-[1.03]",
        )}
      />
    </span>
  );
}
