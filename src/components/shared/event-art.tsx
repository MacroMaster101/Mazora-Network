"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { EventItem } from "@/lib/types";
import { CoverArt } from "./cover-art";
import { cn } from "@/lib/utils";

/**
 * An event's cover image, or the generated cover when it has none or the image
 * fails to load. Covers are always our own storage or a site path (the admin
 * action re-hosts outside links), so they go through the image optimiser.
 */
export function EventArt({
  event,
  height,
  sizes,
  priority = false,
  className,
}: {
  event: Pick<EventItem, "imageUrl" | "accent" | "icon">;
  height: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [event.imageUrl]);

  if (!event.imageUrl || failed) {
    return <CoverArt accent={event.accent} icon={event.icon} height={height} className={className} />;
  }

  return (
    <span className={cn("relative block overflow-hidden bg-page/60", height, className)}>
      <Image
        src={event.imageUrl}
        alt=""
        fill
        sizes={sizes}
        quality={70}
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
