-- Publisher presentation controls and optional editorial read-time override.
-- Additive and safe to run more than once.
alter table if exists public.news_articles
  add column if not exists team_avatar_url text,
  add column if not exists read_time_minutes integer;

alter table if exists public.news_articles
  drop constraint if exists news_articles_read_time_minutes_check;

alter table if exists public.news_articles
  add constraint news_articles_read_time_minutes_check
  check (read_time_minutes is null or read_time_minutes between 1 and 60);
