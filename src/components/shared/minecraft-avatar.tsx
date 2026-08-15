"use client";

import Image from "next/image";
import { useState } from "react";
import { isMinecraftAvatarUrl } from "@/lib/avatar-source";
import { cn } from "@/lib/utils";
import { accentFor } from "@/lib/utils";

/**
 * Renders a Minecraft head, with a coloured monogram fallback shown while
 * loading or if the image fails (e.g. offline).
 *
 * Source priority: a self-uploaded skin (`skinUrl`, set once a player uploads
 * a real skin file) takes priority over the mc-heads.net lookup by username.
 * The lookup-by-username fallback exists because mc-heads.net returns a
 * default head for unknown players, so there is always something to show —
 * but it only has real data for premium Mojang accounts. Offline/cracked
 * accounts (TLauncher and similar) have no Mojang account for it to look up,
 * so they always got the default head until `skinUrl` gave them a way around
 * that lookup entirely.
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
  const [failed, setFailed] = useState(false);
  const bg = accentFor(username);
  // Old/imported rows may contain a username rather than a URL in skin_head_url.
  // Passing that value straight to <img> turns it into a same-origin request
  // such as /LilyLuvv and produces a visible fallback plus a noisy 404.
  const safeSkinUrl = isMinecraftAvatarUrl(skinUrl) ? skinUrl : null;
  const src = safeSkinUrl || `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size * 2}`;

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
        /*
          next/image rather than a bare <img>, for privacy rather than payload.

          A raw <img> pointing at mc-heads.net is fetched by the VISITOR's
          browser, so that host receives every viewer's IP address, User-Agent
          and Referer — plus the Minecraft username being looked at. These
          avatars render on public, unauthenticated pages (leaderboards,
          /players, /staff, gallery, news bylines), so it applied to every
          anonymous visitor and disclosed which profile they were viewing.

          Routed through /_next/image the fetch happens server-side, and
          mc-heads sees only the Vercel egress IP. mc-heads.net is already in
          next.config.ts remotePatterns, and the onError monogram fallback below
          still covers an upstream failure — which now surfaces as an optimizer
          error rather than a browser one.
        */
        <Image
          src={src}
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
