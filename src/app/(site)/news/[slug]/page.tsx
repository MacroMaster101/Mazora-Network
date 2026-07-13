import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getArticle, getNews, getRelatedArticles } from "@/lib/data/content";
import { fmtDate } from "@/lib/utils";
import { CoverArt, NewsCard, Reveal } from "@/components/shared";
import { TonePill } from "@/components/ui";
import { ShareButtons } from "@/components/shared/share-buttons";

export async function generateStaticParams() {
  const news = await getNews();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: { title: article.title, description: article.excerpt, type: "article", authors: [article.author] },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  const related = await getRelatedArticles(article.slug, article.category);

  return (
    <article>
      <CoverArt accent={article.accent} icon="Sparkles" height="h-[14.75rem] sm:h-[17.75rem]" className="article-cover" />
      <div className="shell -mt-12 max-w-3xl">
        <div className="glass p-7 sm:p-10">
          <Link href="/news" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> Back to news
          </Link>
          <TonePill tone={article.accent}>{article.category}</TonePill>
          <h1 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">{article.title}</h1>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
            <div className="flex items-center gap-3 text-sm text-muted">
              <span className="font-semibold text-ink">{article.author}</span>
              <span className="telemetry">
                {fmtDate(article.date)} · {article.readMinutes} min read
              </span>
            </div>
            <ShareButtons title={article.title} />
          </div>

          <div className="prose-invert mt-6 space-y-5">
            {article.body.map((para, i) => (
              <p key={i} className="text-pretty leading-relaxed text-muted">
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section shell">
          <Reveal>
            <h2 className="text-2xl font-bold">Related reading</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <NewsCard key={r.slug} article={r} />
              ))}
            </div>
          </Reveal>
        </section>
      )}
    </article>
  );
}
