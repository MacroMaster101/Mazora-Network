-- Indexes and a stored vote count for reads that grew with the data.
--
-- 1. Foreign-key columns with no index of their own. Deleting an account (the
--    member themself, staff, or the nightly cleanup of unconfirmed sign-ups)
--    cascades or nulls through each of these, and without an index every one
--    of those is a full scan of the table. audit_logs_idx starts with
--    created_at, and the unique indexes on suggestion_votes and gallery_likes
--    start with the other column, so none of them serves these lookups.
--
-- 2. The suggestion board's feeds: newest first, filtered by status or by
--    category. They had nothing but the primary key and sorted the whole table.
--
-- 3. suggestions.votes_count, kept by a trigger, so "Top" sorts on a stored
--    column instead of counting every vote of every suggestion on each view.
--    A trigger rather than the vote action, so every path that adds or removes
--    a vote (the action, an account delete cascading its votes away, a staff
--    clean-up in SQL) keeps the count right.
--
-- 4. notifications(created_at) for the retention job, and
--    minecraft_accounts(lower(minecraft_username)), which the player directory
--    joins on.
--
-- Built inside the migration's transaction, not CONCURRENTLY: the Supabase CLI
-- runs each file in a transaction, and these tables are small today. Indexes on
-- large tables later should be built CONCURRENTLY, in a file of their own.
-- Every statement is idempotent, so re-running this file changes nothing.

begin;

-- 1. Foreign keys.
create index if not exists forum_posts_user_idx on public.forum_posts (user_id);
create index if not exists suggestion_replies_user_idx on public.suggestion_replies (user_id);
create index if not exists suggestions_user_idx on public.suggestions (user_id);
create index if not exists suggestion_votes_user_idx on public.suggestion_votes (user_id);
create index if not exists suggestion_images_user_idx on public.suggestion_images (user_id);
create index if not exists forum_post_images_user_idx on public.forum_post_images (user_id);
create index if not exists content_reports_reporter_idx on public.content_reports (reporter_id);
create index if not exists forum_reports_reporter_idx on public.forum_reports (reporter_id);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
create index if not exists gallery_likes_image_idx on public.gallery_likes (image_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists invoice_items_product_idx on public.invoice_items (product_id);
create index if not exists vote_history_site_idx on public.vote_history (vote_site_id);

-- 2. Suggestion feeds.
create index if not exists suggestions_feed_idx on public.suggestions (created_at desc, id desc);
create index if not exists suggestions_status_feed_idx on public.suggestions (status, created_at desc, id desc);
create index if not exists suggestions_category_feed_idx on public.suggestions (category, created_at desc, id desc);

-- 3. Stored vote count.
alter table public.suggestions add column if not exists votes_count integer not null default 0;

create or replace function public.suggestion_votes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    update public.suggestions set votes_count = votes_count + 1 where id = new.suggestion_id;
  elsif tg_op = 'DELETE' then
    update public.suggestions set votes_count = greatest(votes_count - 1, 0) where id = old.suggestion_id;
  end if;
  return null;
end;
$fn$;

revoke all on function public.suggestion_votes_count() from public, anon, authenticated;

drop trigger if exists suggestion_votes_count on public.suggestion_votes;
create trigger suggestion_votes_count
  after insert or delete on public.suggestion_votes
  for each row execute function public.suggestion_votes_count();

-- Backfill, and correct any count that drifted: only rows that differ are written.
update public.suggestions s
set votes_count = counted.votes
from (
  select s2.id, count(v.id)::integer as votes
  from public.suggestions s2
  left join public.suggestion_votes v on v.suggestion_id = s2.id
  group by s2.id
) counted
where counted.id = s.id
  and s.votes_count is distinct from counted.votes;

create index if not exists suggestions_top_idx on public.suggestions (votes_count desc, created_at desc, id desc);

-- 4. Retention and the directory join.
create index if not exists notifications_created_idx on public.notifications (created_at);
create index if not exists minecraft_accounts_username_lower_idx on public.minecraft_accounts (lower(minecraft_username));

commit;
