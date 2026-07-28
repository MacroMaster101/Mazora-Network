-- Rich public bylines for manual and Discord-authored news.
-- Additive and idempotent so it is safe to re-run.

alter table public.news_articles add column if not exists author_name text;
alter table public.news_articles add column if not exists author_role text;
alter table public.news_articles add column if not exists author_avatar_url text;
alter table public.news_articles add column if not exists publisher_mode text not null default 'team';
alter table public.news_articles add column if not exists discord_author_role text;
alter table public.news_articles add column if not exists discord_author_avatar_url text;

update public.news_articles
set
  publisher_mode = case when source = 'discord' then 'author' else 'team' end,
  author_name = coalesce(author_name, discord_author, 'Mazora Team'),
  author_role = coalesce(
    author_role,
    case when source = 'discord' then 'Discord Publisher' else 'Official Newsroom' end
  )
where author_name is null or author_role is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'news_publisher_mode_check'
  ) then
    alter table public.news_articles
      add constraint news_publisher_mode_check check (publisher_mode in ('team', 'author'));
  end if;
end $$;
