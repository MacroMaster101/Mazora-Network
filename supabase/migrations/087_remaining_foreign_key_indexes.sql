-- Indexes for the foreign keys 083 left out.
--
-- The database linter lists eight foreign keys with no index of their own.
-- Deleting the row they point at (an account, a suggestion, a reply) nulls or
-- cascades through each one, and without an index that is a full scan of the
-- table. The tables are small today; content_reports and forum_reports grow
-- with the community, and content_reports carries three of the eight.
--
-- The "unused index" notices stay: those indexes serve the same deletes and
-- the leaderboards, and are unused only because the tables are still small
-- enough to scan.
--
-- Built inside the migration's transaction, not CONCURRENTLY, as in 083.
-- Every statement is idempotent, so re-running this file changes nothing.

begin;

create index if not exists content_creators_created_by_idx on public.content_creators (created_by);
create index if not exists content_reports_suggestion_idx on public.content_reports (suggestion_id);
create index if not exists content_reports_reply_idx on public.content_reports (reply_id);
create index if not exists content_reports_resolved_by_idx on public.content_reports (resolved_by);
create index if not exists creator_codes_created_by_idx on public.creator_codes (created_by);
create index if not exists forum_reports_resolved_by_idx on public.forum_reports (resolved_by);
create index if not exists news_articles_author_idx on public.news_articles (author_id);
create index if not exists notification_broadcasts_actor_idx on public.notification_broadcasts (actor_id);

commit;
