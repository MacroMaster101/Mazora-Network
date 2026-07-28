"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import type { NewsArticle } from "@/lib/types";
import { ArticleArt } from "./article-art";
import { NewsCard } from "./news-card";
import { NewsAuthor } from "./news-author";
import { cn, fmtDate } from "@/lib/utils";

const NEWS_PAGE_SIZE = 7;

export function NewsExplorer({ articles }: { articles: NewsArticle[] }) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(articles.map((a) => a.category)))], [articles]);
  const [active, setActive] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesCategory = active === "All" || article.category === active;
      const matchesQuery =
        !needle ||
        `${article.title} ${article.excerpt} ${article.category} ${article.author}`.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [active, articles, query]);

  const totalPages = Math.max(1, Math.ceil(list.length / NEWS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageArticles = list.slice(currentPage * NEWS_PAGE_SIZE, (currentPage + 1) * NEWS_PAGE_SIZE);
  const featured = pageArticles[0];
  const rest = pageArticles.slice(1);

  function choosePage(nextPage: number) {
    setPage(Math.max(0, Math.min(totalPages - 1, nextPage)));
    requestAnimationFrame(() => {
      document.querySelector(".newsroom-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="newsroom-explorer">
      <div className="newsroom-controls">
        <div className="min-w-0">
          <div className="newsroom-archive-heading">
            <span><SlidersHorizontal size={14} /> News archive</span>
            <strong>{list.length} {list.length === 1 ? "result" : "results"}</strong>
          </div>
          <div className="newsroom-filters" role="tablist" aria-label="Filter news by category">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active === category}
                onClick={() => {
                  setActive(category);
                  setPage(0);
                }}
                className={cn("newsroom-filter", active === category && "newsroom-filter-active")}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <label className="newsroom-search">
          <Search size={16} />
          <span className="sr-only">Search news</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search stories"
          />
        </label>
      </div>

      {featured ? (
        <>
          <Link href={`/news/${featured.slug}`} className="newsroom-feature group">
            <div className="newsroom-feature-art">
              <ArticleArt
                article={featured}
                height="min-h-[19rem] md:min-h-[32rem]"
                sizes="(max-width: 768px) 100vw, 62vw"
                priority
                hoverZoom
              />
              <span className="newsroom-feature-badge"><Sparkles size={13} /> Lead story</span>
            </div>
            <div className="newsroom-feature-copy">
              <div className="flex flex-wrap items-center gap-3">
                <span className="news-public-kicker">{featured.category}</span>
                <span className="telemetry text-xs text-muted">{fmtDate(featured.date)}</span>
              </div>
              <h2 className="mt-5 text-balance font-display text-3xl font-black leading-[1.05] sm:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-4 line-clamp-4 text-base leading-relaxed text-muted">{featured.excerpt}</p>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
                <NewsAuthor article={featured} compact />
                <span className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><Clock3 size={13} /> {featured.readMinutes} min</span>
                  <span className="flex items-center gap-1.5 font-semibold text-accent-bright">
                    Read the story <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </div>
            </div>
          </Link>

          {rest.length > 0 && (
            <div className="newsroom-story-grid">
              {rest.map((article) => <NewsCard key={article.slug} article={article} />)}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="newsroom-pagination" aria-label="News pagination">
              <button
                type="button"
                onClick={() => choosePage(currentPage - 1)}
                disabled={currentPage === 0}
                aria-label="Previous news page"
                className="newsroom-page-button newsroom-page-arrow"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => choosePage(index)}
                  aria-label={`Go to news page ${index + 1}`}
                  aria-current={index === currentPage ? "page" : undefined}
                  className="newsroom-page-button"
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => choosePage(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                aria-label="Next news page"
                className="newsroom-page-button newsroom-page-arrow"
              >
                <ChevronRight size={18} />
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="newsroom-no-results">
          <Search size={22} />
          <h3>No stories found</h3>
          <p>Try another category or a broader search.</p>
          <button
            type="button"
            onClick={() => {
              setActive("All");
              setQuery("");
              setPage(0);
            }}
            className="btn btn-ghost btn-sm mt-4"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
