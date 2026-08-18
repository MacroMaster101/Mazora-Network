"use client";

import { useState } from "react";
import type { NewsArticle } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Rendered size of .news-author-avatar (2.25rem).
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            width={AVATAR_PX}
            height={AVATAR_PX}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
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
