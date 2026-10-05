"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

/**
 * The artwork behind an event cover: the staff-set image, or a generated night
 * scene when there is none or it fails to load. Always dark, in both themes,
 * because the cover's text is light (see events.css).
 */
export function EventCoverMedia({
  imageUrl,
  sizes,
  priority = false,
  scrim = true,
}: {
  imageUrl?: string | null;
  sizes: string;
  priority?: boolean;
  /** The dark wash under cover text. Cards show their art clear and keep text beside it. */
  scrim?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);

  return (
    <div className={scrim ? "event-cover-art" : "event-cover-art no-scrim"} aria-hidden>
      {imageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes={sizes}
          quality={75}
          priority={priority}
          className="event-cover-image object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="event-cover-fallback">
          <Trophy className="event-cover-mark" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
