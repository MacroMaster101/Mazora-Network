"use client";

import { useState } from "react";
import Image from "next/image";
import type { NewsArticle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isOptimisableImage } from "@/lib/image-hosts";

/**
 * Rendered size of .news-author-avatar (2.25rem). The CSS already stretches the
 * image to fill the tile; this is only what next/image requests from the
 * optimiser, so it wants to match the real box.
 */
const AVATAR_PX = 36;

export function NewsAuthor({
  article,
  compact = false,
}: {
  article: Pick<NewsArticle, "author" | "authorRole" | "authorAvatar" | "publisherMode">;
  compact?: boolean;
}) {
  // Avatars are a snapshot URL taken when the article was published. If the
  // author later replaces that photo (a fresh upload, or switching to a
  // Minecraft skin avatar), the old file is deleted and this URL 404s — fall
  // back to initials rather than showing a broken image.
  const [imageFailed, setImageFailed] = useState(false);

  const isTeam = article.publisherMode === "team" || /^(the )?mazora team$/i.test(article.author);
  const avatar = !imageFailed && (article.authorAvatar || (isTeam ? "/images/mazora-icon.png" : undefined));
  const role = article.authorRole || (isTeam ? "Official Newsroom" : "News Publisher");
  const fallback = article.author.trim().slice(0, 1).toUpperCase() || "M";

  return (
    <span className={cn("news-author", compact && "news-author-compact")}>
      <span className={cn("news-author-avatar", isTeam && "news-author-avatar-team")}>
        {avatar ? (
          /*
            Routed through next/image when the host is one we've configured, so
            the byline avatar is served same-origin with our own cache headers
            instead of hot-linking a third party on every visit — mc-heads.net
            sends a 1-hour TTL, which is what Lighthouse flagged under "use
            efficient cache lifetimes".

            The <img> fallback is not dead code: these URLs are snapshots taken
            at publish time and the host set is open-ended, and an unconfigured
            host passed to <Image> throws. See lib/image-hosts.ts.
          */
          isOptimisableImage(avatar) ? (
            <Image
              src={avatar}
              alt=""
              width={AVATAR_PX}
              height={AVATAR_PX}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
          )
        ) : (
          <span className="news-author-fallback">{fallback}</span>
        )}
      </span>
      <span className="news-author-copy">
        <strong>{isTeam ? "Mazora Team" : article.author}</strong>
        <small>{role}</small>
      </span>
    </span>
  );
}
