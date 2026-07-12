"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { accentFor } from "@/lib/utils";

/**
 * Renders a Minecraft head from a skin API, with a coloured monogram fallback
 * shown while loading or if the image fails (e.g. offline). mc-heads returns a
 * default head for unknown players, so there is always something to show.
 */
export function MinecraftAvatar({
  username,
  size = 48,
  className,
  rounded = "rounded-lg",
}: {
  username: string;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const bg = accentFor(username);

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", rounded, className)}
      style={{ width: size, height: size, background: `${bg}22` }}
      aria-hidden
    >
      <span className="font-display text-xs font-bold" style={{ color: bg }}>
        {username.slice(0, 2).toUpperCase()}
      </span>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size * 2}`}
          alt={`${username}'s Minecraft head`}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      )}
    </span>
  );
}
