import type { NewsArticle } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NewsAuthor({
  article,
  compact = false,
}: {
  article: Pick<NewsArticle, "author" | "authorRole" | "authorAvatar" | "publisherMode">;
  compact?: boolean;
}) {
  const isTeam = article.publisherMode === "team" || /^(the )?mazora team$/i.test(article.author);
  const avatar = article.authorAvatar || (isTeam ? "/images/mazora-icon.png" : undefined);
  const role = article.authorRole || (isTeam ? "Official Newsroom" : "News Publisher");
  const fallback = article.author.trim().slice(0, 1).toUpperCase() || "M";

  return (
    <span className={cn("news-author", compact && "news-author-compact")}>
      <span className={cn("news-author-avatar", isTeam && "news-author-avatar-team")}>
        {avatar ? (
          // Byline avatars may be stored profile images or Discord CDN images.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" />
        ) : (
          <span>{fallback}</span>
        )}
      </span>
      <span className="news-author-copy">
        <strong>{isTeam ? "Mazora Team" : article.author}</strong>
        <small>{role}</small>
      </span>
    </span>
  );
}
