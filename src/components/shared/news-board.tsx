"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { NewsArticle } from "@/lib/types";
import { ArticleArt } from "./article-art";
import { CoverArt } from "./cover-art";
import { NewsAuthor } from "./news-author";
import { TonePill } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

const categoryIcon: Record<string, string> = {
  "Server Updates": "Sparkles",
  Announcements: "Sparkles",
  "Patch Notes": "Swords",
  Events: "Trophy",
  Maintenance: "Cpu",
  Community: "Users",
  "Development Updates": "Cpu",
};

function ReadPill({ minutes }: { minutes: number }) {
  return (
    <span className="chip shrink-0 gap-1.5">
      <Clock size={12} /> {minutes} min read
    </span>
  );
}

function AuthorRow({ article }: { article: NewsArticle }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <NewsAuthor article={article} compact />
      <span className="telemetry shrink-0 text-xs text-muted">{fmtDate(article.date)}</span>
    </div>
  );
}

/** The article's artwork, falling back to the category's generated cover. */
function CardArt({ article, height, sizes }: { article: NewsArticle; height: string; sizes: string }) {
  if (!article.featuredImage) {
    return <CoverArt accent={article.accent} icon={categoryIcon[article.category] ?? "Sparkles"} height={height} />;
  }
  return <ArticleArt article={article} height={height} sizes={sizes} hoverZoom />;
}

function FeaturedCard({ article }: { article: NewsArticle }) {
  return (
    <Link href={`/news/${article.slug}`} className="news-home-feature group grid overflow-hidden lg:grid-cols-[1.2fr_0.8fr]">
      <CardArt article={article} height="h-64 lg:h-full lg:min-h-[25rem]" sizes="(max-width: 1024px) 100vw, 56vw" />
      <div className="flex flex-col p-6 sm:p-8 lg:p-10">
        <TonePill tone={article.accent} className="self-start">
          {article.category}
        </TonePill>
        <h3 className="mt-5 text-balance font-display text-3xl font-black leading-[1.05] transition-colors group-hover:text-accent-bright">
          {article.title}
        </h3>
        <p className="mt-4 line-clamp-4 flex-1 leading-relaxed text-muted">{article.excerpt}</p>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
          <AuthorRow article={article} />
          <ReadPill minutes={article.readMinutes} />
        </div>
      </div>
    </Link>
  );
}

function GridCard({ article }: { article: NewsArticle }) {
  return (
    <Link href={`/news/${article.slug}`} className="news-home-card group grid overflow-hidden sm:grid-cols-[10rem_1fr]">
      <CardArt article={article} height="h-44 sm:h-full sm:min-h-[13rem]" sizes="(max-width: 640px) 100vw, 160px" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <TonePill tone={article.accent} className="self-start">
          {article.category}
        </TonePill>
        <h3 className="mt-3 font-display text-lg font-bold leading-snug group-hover:text-accent-bright">{article.title}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{article.excerpt}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <AuthorRow article={article} />
          <ReadPill minutes={article.readMinutes} />
        </div>
      </div>
    </Link>
  );
}

/**
 * Homepage news board: the five newest stories, followed by one clear route to
 * the complete, paginated archive.
 */
export function NewsBoard({ articles, limit = 5 }: { articles: NewsArticle[]; limit?: number }) {
  if (articles.length === 0) return null;

  const latest = articles.slice(0, limit);
  const featured = latest[0];
  const rest = latest.slice(1);

  return (
    <div className="space-y-6">
      <FeaturedCard article={featured} />

      {rest.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {rest.map((article) => (
            <GridCard key={article.slug} article={article} />
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link href="/news" className="home-news-more group inline-flex items-center gap-1.5 text-sm font-semibold text-accent-bright">
          View all news <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
