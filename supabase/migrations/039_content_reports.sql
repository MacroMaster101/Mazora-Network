/*
 * Community reporting for the suggestions board.
 *
 * Targets are two nullable foreign keys plus a CHECK, not the usual
 * target_type/target_id pair. The polymorphic shortcut gives up referential
 * integrity: deleting a suggestion would leave reports pointing at nothing.
 * This shape lets Postgres enforce both "exactly one target" and "the target
 * exists", and cascades cleanly.
 */
begin;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  suggestion_id uuid references public.suggestions(id) on delete cascade,
  reply_id uuid references public.suggestion_replies(id) on delete cascade,
  reason text not null
    check (reason in ('spam', 'abuse', 'off_topic', 'duplicate', 'other')),
  note text check (note is null or char_length(note) between 1 and 1000),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint content_reports_one_target
    check (num_nonnulls(suggestion_id, reply_id) = 1)
);

/* Two PARTIAL unique indexes, not one composite index over all three columns.
   Exactly one target column is always NULL, and Postgres treats NULLs as
   DISTINCT in a unique index — a composite index would accept unlimited
   duplicate reports and the one-per-member guarantee would silently do
   nothing. Verified empirically against this database before writing it. */
create unique index if not exists content_reports_one_per_suggestion
  on public.content_reports(reporter_id, suggestion_id) where suggestion_id is not null;

create unique index if not exists content_reports_one_per_reply
  on public.content_reports(reporter_id, reply_id) where reply_id is not null;

create index if not exists content_reports_queue_idx
  on public.content_reports(status, created_at desc);

alter table public.content_reports enable row level security;

/* A report names its reporter, so it is never publicly readable — publishing
   who reported whom invites retaliation. Staff read through the server's
   DATABASE_URL connection, which bypasses RLS. Members may only file reports
   as themselves. */
drop policy if exists "reports owner insert" on public.content_reports;
create policy "reports owner insert" on public.content_reports
  for insert to authenticated with check (reporter_id = auth.uid());

commit;
