"use client";

import Image from "next/image";
import { useState } from "react";
import { isMinecraftAvatarUrl } from "@/lib/avatar-source";
import { mcHeadsAvatarUrl } from "@/lib/minecraft/skin";
import { cn } from "@/lib/utils";
import { accentFor } from "@/lib/utils";

/**
 * Renders a Minecraft head avatar.
 *
 * Source priority:
 * 1. A self-uploaded skin (`skinUrl`) takes first priority.
 * 2. If absent or invalid, looks up the Minecraft head by username on mc-heads.net.
 * 3. If that lookup fails (e.g. offline/unknown player name or missing storage file), falls back to the default Steve head.
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
  const [triedSteve, setTriedSteve] = useState(false);
  const [allFailed, setAllFailed] = useState(false);

  const bg = accentFor(username);
  const safeSkinUrl = isMinecraftAvatarUrl(skinUrl) ? skinUrl : null;
  const primarySrc = safeSkinUrl || mcHeadsAvatarUrl(username, size * 2);
  const steveSrc = mcHeadsAvatarUrl("Steve", size * 2);

  const currentSrc = triedSteve ? steveSrc : primarySrc;

  const handleImageError = () => {
    if (!triedSteve && username.toLowerCase() !== "steve") {
      setTriedSteve(true);
    } else {
      setAllFailed(true);
    }
  };

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", rounded, className)}
      style={{ width: size, height: size, background: `${bg}22` }}
      aria-hidden
    >
      <span className="font-display text-xs font-bold" style={{ color: bg }}>
        {username.slice(0, 2).toUpperCase()}
      </span>
      {!allFailed && (
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
