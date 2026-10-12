"use client";

import Image from "next/image";
import { useState } from "react";
import { isMinecraftAvatarUrl } from "@/lib/avatar-source";
import { mcHeadsAvatarName, mcHeadsAvatarUrl, playerHeadUrl } from "@/lib/minecraft/skin";
import { cn } from "@/lib/utils";
import { accentFor } from "@/lib/utils";

/**
 * Renders a Minecraft head avatar.
 *
 * Source priority:
 * 1. A self-uploaded skin (`skinUrl`) takes first priority.
 * 2. Otherwise the site's own head route draws the skin Mojang has for the
 *    name (it hands off to mc-heads.net when Mojang has none). An mc-heads URL
 *    passed as `skinUrl`, such as a saved profile picture, goes through the
 *    route too: mc-heads can show Steve at one size and the skin at another.
 * 3. If that fails (e.g. missing storage file), falls back to the default Steve head.
 * 4. As a final fallback (e.g. total network failure), renders a monogram letter.
 */
export function MinecraftAvatar({
  username,
  skinUrl,
  size = 48,
  className,
  rounded = "rounded-lg",
}: {
  username: string;
  /** A self-uploaded skin's processed head icon. Takes priority over the mc-heads.net lookup when set. */
  skinUrl?: string | null;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  // Which source in `sources` is showing; past the end means all of them failed.
  const [attempt, setAttempt] = useState(0);

  const bg = accentFor(username);
  const mcHeadsName = mcHeadsAvatarName(skinUrl);
  const uploadedSkinUrl = !mcHeadsName && isMinecraftAvatarUrl(skinUrl) ? skinUrl : null;
  const headSrc = playerHeadUrl(mcHeadsName ?? username);
  const steveSrc = mcHeadsAvatarUrl("Steve", size * 2);
  // An uploaded file can go missing from storage; the Mojang head comes next,
  // then Steve. Steve is skipped when the player is Steve, as it always was.
  const sources = [uploadedSkinUrl, headSrc, username.toLowerCase() === "steve" ? null : steveSrc].filter(
    (src): src is string => Boolean(src),
  );
  const currentSrc = sources[attempt];

  const handleImageError = () => setAttempt((value) => value + 1);

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", rounded, className)}
      style={{ width: size, height: size, background: `${bg}22` }}
      aria-hidden
    >
      <span className="user-avatar-monogram font-display text-xs font-bold" style={{ color: bg }}>
        {username.slice(0, 2).toUpperCase()}
      </span>
      {currentSrc && (
        <Image
          key={currentSrc}
          src={currentSrc}
          alt={`${username}'s Minecraft head`}
          width={size}
          height={size}
          loading="lazy"
          unoptimized
          onError={handleImageError}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      )}
    </span>
  );
}
