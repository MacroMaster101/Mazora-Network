/*
 * Least privilege for the two browser-shipped roles on public content.
 *
 * Context: the anon key ships to every browser, so `anon` and `authenticated`
 * are attacker-reachable by definition. RLS already denies anon writes, but the
 * table GRANTs underneath were Supabase's permissive defaults (INSERT/UPDATE on
 * every public-content table). That made RLS the *only* control standing
 * between a visitor and a defacement: one over-broad policy added later, or one
 * table with RLS disabled by accident, and the grant is immediately live. This
 * removes the second half of that pair, so a policy mistake alone is not
 * sufficient to write.
 *
 * Part 1 additionally stops `author_id` reaching the browser. It is the
 * auth.users UUID behind a public byline and nothing renders from it: the site
 * reads news and gallery server-side (Drizzle on DATABASE_URL, or the
 * service-role client) and displays author_name/author_avatar_url instead.
 *
 * Note on Postgres semantics: a table-level SELECT grant lets a role read EVERY
 * column, so revoking the single column is not enough — the table grant has to
 * go first, then the allowed columns are granted back explicitly. A column
 * added later is therefore not exposed until someone grants it deliberately,
 * which is the failure direction we want.
 */
begin;

-- Part 1: public read of news/gallery, minus the author UUID.
revoke select on public.news_articles from anon, authenticated;
grant select (
  id, title, slug, excerpt, content, featured_image, category, status,
  author_name, published_at, created_at, updated_at, source,
  discord_message_id, discord_author, author_role, author_avatar_url,
  publisher_mode, discord_author_role, discord_author_avatar_url,
  team_avatar_url, read_time_minutes
) on public.news_articles to anon, authenticated;

revoke select on public.gallery_images from anon, authenticated;
grant select (
  id, title, image_url, category, created_at, description, thumbnail_url,
  author_name, status, featured, likes_count, updated_at
) on public.gallery_images to anon, authenticated;

-- Part 2: admin-managed content is read-only to the browser roles. Every write
-- in this application goes through a Server Action on the postgres role
-- (DATABASE_URL) or the service-role client, so neither role loses a code path
-- that is actually used.
revoke insert, update, delete on
  public.news_articles,
  public.gallery_images,
  public.events,
  public.game_modes,
  public.products,
  public.rules,
  public.rule_categories,
  public.vote_sites
from anon, authenticated;

commit;
