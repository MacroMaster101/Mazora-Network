import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Clock3, Radio } from "lucide-react";
import { getArticle, getRelatedArticles } from "@/lib/data/content";
import { getNewsArticleReadCount } from "@/lib/data/news-visitors";
import { fmtDate } from "@/lib/utils";
import { ArticleArt, NewsAuthor, NewsCard, Reveal } from "@/components/shared";
import { NewsVisitorStat } from "@/components/shared/news-visitor-stat";
import { ShareButtons } from "@/components/shared/share-buttons";
import "@/styles/news-article.css";

// Per-request so an unknown slug returns a real 404 instead of a soft 200, and
// so newly published articles are live immediately. See the store detail page
// for the full reasoning.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      authors: [article.author],
      publishedTime: article.date,
      ...(article.featuredImage ? { images: [{ url: article.featuredImage }] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const [related, articleReadCount] = await Promise.all([
    getRelatedArticles(article.slug, article.category),
    getNewsArticleReadCount(article.slug),
  ]);

  return (
    <article className="news-article-page">
      <header className="news-detail-hero">
        <div className="news-detail-hero-backdrop" aria-hidden="true" />
        <div className="shell news-detail-hero-shell">
          <div className="news-detail-topline">
            <Link href="/news" className="news-detail-back">
              <ArrowLeft size={15} /> Back to news
            </Link>
            <div className="news-detail-live"><Radio size={13} /> Mazora dispatch</div>
          </div>

          <div className="news-detail-mast">
            <div className="newsroom-mast-stat newsroom-mast-stat-left news-detail-read-stat">
              <span className="newsroom-stat-label">
                <Clock3 size={16} aria-hidden="true" />
                <small>Reading time</small>
              </span>
              <strong>{article.readMinutes}</strong>
              <em>min</em>
            </div>

            <div className="news-detail-brand">
              <span className="news-detail-brand-aura" aria-hidden="true" />
              <Image
                src="/images/mazora-logo.webp"
                alt="Mazora Network"
                width={300}
                height={200}
                priority
                className="news-detail-logo animate-float"
              />
            </div>

            <NewsVisitorStat initialCount={articleReadCount} articleSlug={article.slug} />
          </div>

          <div className="news-detail-intro">
            <div className="news-detail-kicker-row">
              <span className="news-detail-kicker">{article.category}</span>
              <span>{fmtDate(article.date)}</span>
            </div>
            <h1>{article.title}</h1>
            {article.excerpt && <p>{article.excerpt}</p>}
            <div className="news-detail-meta">
              <NewsAuthor article={article} compact />
              <span><CalendarDays size={15} /> {fmtDate(article.date)}</span>
              <ShareButtons />
            </div>
          </div>
        </div>
      </header>

      <div className="news-detail-world">
        <div className="shell news-detail-feature-wrap">
          <ArticleArt
            article={article}
            height="aspect-[16/9] min-h-[13rem] sm:min-h-[20rem]"
            sizes="(max-width: 1200px) 100vw, 1152px"
            priority
            fit="cover"
            className="news-detail-feature-art"
          />
        </div>

        <div className="shell news-detail-content">
          <main className="news-detail-reading">
            <div className="news-detail-reading-label">From the newsroom</div>
            <div className="news-article-body">
              {article.body.map((paragraph, index) => (
                <p key={index} className={index === 0 ? "news-article-lead" : undefined}>{paragraph}</p>
              ))}
            </div>
          </main>

          <aside className="news-detail-aside">
            <div className="news-detail-aside-card">
              <span className="news-detail-aside-eyebrow">Story details</span>
              <div className="news-detail-publisher-card">
                <span className="news-detail-publisher-label"><BadgeCheck size={13} /> Publisher</span>
                <NewsAuthor article={article} />
                <p>
                  {article.publisherMode === "team"
                    ? "Official news published by the Mazora Network newsroom."
                    : "Published by an authenticated member of the Mazora team."}
                </p>
              </div>
              <dl>
                <div><dt>Published</dt><dd>{fmtDate(article.date)}</dd></div>
                <div><dt>Category</dt><dd>{article.category}</dd></div>
                <div><dt>Reading time</dt><dd>{article.readMinutes} min</dd></div>
              </dl>
              <Link href="/news" className="news-detail-archive-link">
                Explore all news <ArrowRight size={15} />
              </Link>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="shell news-detail-related">
            <Reveal>
              <div className="news-detail-related-head">
                <div>
                  <div className="news-detail-reading-label">Continue exploring</div>
                  <h2>More from the newsroom</h2>
                </div>
                <Link href="/news" className="news-detail-archive-link">
                  All news <ArrowRight size={15} />
                </Link>
              </div>
              <div className="news-detail-related-grid">
                {related.map((story) => <NewsCard key={story.slug} article={story} />)}
              </div>
            </Reveal>
          </section>
        )}
      </div>
    </article>
  );
}
