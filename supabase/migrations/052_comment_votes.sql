/*
 * Votes on comments: forum posts and suggestion replies.
 *
 * One row per member per comment, +1 or -1. Removing a vote deletes the row,
 * so there is never a 0. Scores are counted from these rows on read, the same
 * reasoning as the forum board's computed counts: a stored score drifts.
 *
 * Every write goes through a checked server action on DATABASE_URL, so the
 * browser-facing roles get no write privileges and RLS closes PostgREST reads
 * (who voted which way is not public) — the pattern from migrations 045/046.
 */
begin;

create table if not exists public.forum_post_votes (
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.suggestion_reply_votes (
  reply_id   uuid not null references public.suggestion_replies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

-- "My votes on this page" reads by voter.
create index if not exists forum_post_votes_user_idx on public.forum_post_votes (user_id);
create index if not exists suggestion_reply_votes_user_idx on public.suggestion_reply_votes (user_id);

revoke insert, update, delete on public.forum_post_votes, public.suggestion_reply_votes from anon, authenticated;

alter table public.forum_post_votes enable row level security;
alter table public.suggestion_reply_votes enable row level security;

commit;
