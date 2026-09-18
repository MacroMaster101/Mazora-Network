/*
 * Threaded forum replies: a post may answer another post in the same topic.
 *
 * One level deep, matching suggestion replies (migration 039): answering a
 * reply attaches to that reply's own parent, which the server action enforces.
 * Null means a top-level post. Posts are soft-deleted, so the cascade only
 * matters if a topic is ever hard-deleted, where it already cascades anyway.
 */
begin;

alter table public.forum_posts
  add column if not exists parent_id uuid references public.forum_posts(id) on delete cascade;

create index if not exists forum_posts_parent_idx
  on public.forum_posts (parent_id, created_at)
  where parent_id is not null;

commit;
