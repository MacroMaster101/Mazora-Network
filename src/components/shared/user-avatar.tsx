"use client";

import { useEffect, useRef, useState } from "react";
import { cn, accentFor } from "@/lib/utils";

/**
 * A website account's avatar — whatever that member actually chose.
 *
 * `avatarUrl` already encodes the choice made in profile settings: an uploaded
 * photo, or the mc-heads skin URL written when they pick "Minecraft skin". When
 * they have chosen nothing it falls back to the photo that came with their
 * sign-in provider, and finally to a coloured monogram.
 *
 * This is deliberately NOT MinecraftAvatar: that component renders a skin head
 * from a username unconditionally, which meant every account in the admin lists
 * showed a Minecraft head even when the person had uploaded a real photo (and a
 * default Steve head for the majority who never linked an IGN at all).
 */
export function UserAvatar({
  username,
  avatarUrl,
  size = 32,
  className,
  rounded = "rounded-lg",
}: {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const bg = accentFor(username);

  /*
    An image that fails before hydration never reaches onError: the browser
    fired the event while this was still server HTML with no handler attached,
    so the broken-image icon stayed on screen instead of the monogram. That is
    exactly what a dead provider photo does (Discord deletes the old picture
    when a member changes theirs, and the saved link starts returning 404).
    Checking the element once on mount catches the error that already happened.
  */
  useEffect(() => {
    const img = imgRef.current;
    if (img && avatarUrl && img.complete && img.naturalWidth === 0) setFailedUrl(avatarUrl);
  }, [avatarUrl]);

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", rounded, className)}
      style={{ width: size, height: size, background: `${bg}22` }}
      aria-hidden
    >
      <span className="user-avatar-monogram font-display text-xs font-bold" style={{ color: bg }}>
        {username.slice(0, 2).toUpperCase()}
      </span>
      {avatarUrl && avatarUrl !== failedUrl && (
        // Stored avatars come from Supabase storage, mc-heads, or a provider
        // CDN. A deleted upload 404s, so failures fall back to the monogram.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          // Remember the URL that failed rather than a permanent boolean. A
          // refreshed session can then supply a new provider URL immediately
          // without waiting for this mounted header/avatar to be recreated.
          onError={() => setFailedUrl(avatarUrl)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
