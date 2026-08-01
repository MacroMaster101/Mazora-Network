/**
 * Usage: npx tsx --env-file=.env scripts/seed-news-preview.ts
 *
 * Environment comes from tsx's --env-file, matching every other db script.
 * This previously did `import "dotenv/config"`, but dotenv is not a declared
 * dependency — it only resolved transitively through drizzle-kit, so the script
 * would break the moment that tree shifted.
 */
import postgres from "postgres";
import { getPreviewNews } from "../src/lib/news/preview-fixtures";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = postgres(url, { prepare: false });

async function main() {
  const articles = getPreviewNews();

  await sql.begin(async (tx) => {
    for (const article of articles) {
      await tx`
        insert into public.news_articles (
          title,
          slug,
          excerpt,
          content,
          featured_image,
          category,
          status,
          author_name,
          source,
          published_at,
          created_at,
          updated_at
        )
        values (
          ${article.title},
          ${article.slug},
          ${article.excerpt},
          ${article.body.join("\n\n")},
          ${article.featuredImage ?? null},
          ${article.category},
          'published',
          ${article.author},
          'manual',
          ${new Date(article.date)},
          now(),
          now()
        )
        on conflict (slug) do update set
          title = excluded.title,
          excerpt = excluded.excerpt,
          content = excluded.content,
          featured_image = excluded.featured_image,
          category = excluded.category,
          status = excluded.status,
          author_name = excluded.author_name,
          source = excluded.source,
          published_at = excluded.published_at,
          updated_at = now()
      `;
    }
  });

  const [summary] = await sql`
    select count(*)::int as count
    from public.news_articles
    where status = 'published' and slug like 'preview-%'
  `;

  console.log(`Published ${summary.count} database-backed news test stories.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await sql.end();
});
