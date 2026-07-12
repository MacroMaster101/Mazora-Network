"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { NewsArticle } from "@/lib/types";
import { CoverArt } from "./cover-art";
import { MinecraftAvatar } from "./minecraft-avatar";
import { TonePill } from "@/components/ui";
import { cn, fmtDate } from "@/lib/utils";

const categoryIcon: Record<string, string> = {
  "Server Updates": "Sparkles",
  Announcements: "Sparkles",
  "Patch Notes": "Swords",
  Events: "Trophy",
  Maintenance: "Cpu",
  Community: "Users",
  "Development Updates": "Cpu",
};

/** Derive a short avatar handle from a free-form author name. */
function handle(author: string) {
  const cleaned = author.replace(/\(.*?\)/g, "").replace(/^the\s+/i, "").trim();
  return cleaned.split(/\s+/)[0] || author;
}

function ReadPill({ minutes }: { minutes: number }) {
  return (
    <span className="chip shrink-0 gap-1.5">
      <Clock size={12} /> {minutes} min read
    </span>
  );
}

function AuthorRow({ article }: { article: NewsArticle }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <MinecraftAvatar username={handle(article.author)} size={34} rounded="rounded-md" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-accent-bright">{article.author}</p>
        <p className="telemetry text-xs text-muted">{fmtDate(article.date)}</p>
      </div>
    </div>
  );
}

function FeaturedCard({ article }: { article: NewsArticle }) {
  return (
    <Link href={`/news/${article.slug}`} className="panel panel-hover group grid overflow-hidden md:grid-cols-2">
      <CoverArt accent={article.accent} icon={categoryIcon[article.category] ?? "Sparkles"} height="h-56 md:h-full md:min-h-[19rem]" />
      <div className="flex flex-col p-6 sm:p-8">
        <TonePill tone={article.accent} className="self-start">
          {article.category}
        </TonePill>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight group-hover:text-accent-bright sm:text-3xl">
          {article.title}
        </h3>
        <p className="mt-3 line-clamp-3 flex-1 text-muted">{article.excerpt}</p>
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
    <Link href={`/news/${article.slug}`} className="panel panel-hover group flex flex-col overflow-hidden">
      <CoverArt accent={article.accent} icon={categoryIcon[article.category] ?? "Sparkles"} height="h-40" />
      <div className="flex flex-1 flex-col p-5">
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
 * Homepage news board: one large featured story, a paginated card grid of the
 * rest, and pagination controls — modelled on a classic MC-network news layout.
 */
export function NewsBoard({ articles, pageSize = 4 }: { articles: NewsArticle[]; pageSize?: number }) {
  const [page, setPage] = useState(0);
  if (articles.length === 0) return null;

  const featured = articles[0];
  const rest = articles.slice(1);
  const pages = Math.max(1, Math.ceil(rest.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = rest.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="space-y-6">
      <FeaturedCard article={featured} />

      {slice.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {slice.map((a) => (
            <GridCard key={a.slug} article={a} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button
            onClick={() => setPage(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="Previous page"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            «
          </button>
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-current={i === current ? "page" : undefined}
              className={cn(
                "h-9 min-w-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                i === current ? "border-accent bg-accent text-white" : "border-line text-muted hover:text-ink",
              )}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(pages - 1, current + 1))}
            disabled={current === pages - 1}
            aria-label="Next page"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
