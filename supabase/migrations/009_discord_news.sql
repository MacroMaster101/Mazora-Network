-- Announcements are written in Discord and imported here for staff review.
-- Additive and idempotent so it is safe to re-run.

-- 'manual' = written on the site, 'discord' = imported from the announcement channel.
alter table public.news_articles add column if not exists source text not null default 'manual';
alter table public.news_articles add column if not exists discord_message_id text;
alter table public.news_articles add column if not exists discord_author text;

-- Dedup: one article per Discord message. Partial so site-authored rows (null) are unconstrained.
create unique index if not exists news_discord_message_idx
  on public.news_articles (discord_message_id)
  where discord_message_id is not null;

-- Imported items wait for review; the existing public read policy already hides
-- anything whose status is not 'published', so no policy change is needed.
create index if not exists news_status_idx on public.news_articles (status);
