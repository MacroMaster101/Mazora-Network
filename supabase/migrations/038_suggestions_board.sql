/*
 * Suggestions become a readable board with discussion.
 *
 * suggestion_votes has carried only a primary key on id since it was created,
 * so one account could vote on the same suggestion without limit. The unique
 * index below is a correctness fix, not an optimisation.
 */
begin;

create table if not exists public.suggestion_replies (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists suggestion_replies_thread_idx
  on public.suggestion_replies(suggestion_id, created_at);

alter table public.suggestions
  add column if not exists locked boolean not null default false;

/* The unique index below cannot be created while duplicates exist, and a raise
   here would roll back this entire migration. suggestion_votes carried only a
   primary key on id until now, so collapse any duplicates first, keeping the
   earliest vote per member per suggestion. Comparing (created_at, id) rather
   than created_at alone: created_at is not a total order on its own, and two
   votes for the same (suggestion_id, user_id) sharing an identical timestamp
   would both survive a bare `>` comparison, leaving a duplicate behind that
   aborts the unique index creation below (and, inside this transaction, the
   whole migration). id is unique, so the tuple comparison always picks
   exactly one survivor per (suggestion_id, user_id), whatever the
   timestamps — do not "simplify" this back to created_at alone. */
delete from public.suggestion_votes a
using public.suggestion_votes b
where a.suggestion_id = b.suggestion_id
  and a.user_id = b.user_id
  and (a.created_at, a.id) > (b.created_at, b.id);

create unique index if not exists suggestion_votes_unique_voter
  on public.suggestion_votes(suggestion_id, user_id);

alter table public.suggestion_replies enable row level security;

/* Replies are public-readable to members via the Next.js server (DATABASE_URL
   bypasses RLS), so guests see the board. Direct PostgREST access with the
   anon key is denied — the key ships to browsers and would publish user_id
   activity. */
drop policy if exists "replies public read" on public.suggestion_replies;
create policy "replies public read" on public.suggestion_replies
  for select to authenticated using (true);

drop policy if exists "replies owner insert" on public.suggestion_replies;
create policy "replies owner insert" on public.suggestion_replies
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "replies owner update" on public.suggestion_replies;
create policy "replies owner update" on public.suggestion_replies
  for update to authenticated using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

/* Deletion is soft (deleted_at set via UPDATE); hard DELETE stays default-denied. */

commit;
