/*
 * Images attached to a suggestion or to a reply.
 *
 * One table with a polymorphic target — exactly one of suggestion_id /
 * reply_id — because a suggestion image and a reply image have the same
 * lifecycle, the same 4-per-post cap, and the same moderation. This is the
 * shape content_reports (migration 039) already uses in this codebase.
 *
 * storage_key is kept beside url so a delete can remove the stored object,
 * not just the row.
 */
begin;

create table if not exists public.suggestion_images (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references public.suggestions(id) on delete cascade,
  reply_id uuid references public.suggestion_replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  storage_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint suggestion_images_one_target
    check (num_nonnulls(suggestion_id, reply_id) = 1)
);

create index if not exists suggestion_images_suggestion_idx
  on public.suggestion_images(suggestion_id, sort_order) where suggestion_id is not null;
create index if not exists suggestion_images_reply_idx
  on public.suggestion_images(reply_id, sort_order) where reply_id is not null;

alter table public.suggestion_images enable row level security;

/* Reads go through the Next.js server on DATABASE_URL, which bypasses RLS.
   Direct PostgREST access stays closed to anon: this table holds user_id and
   an open policy would publish member activity — the leak class closed by
   migrations 029/030 and matched by 038's reply policies. */
drop policy if exists "suggestion images read" on public.suggestion_images;
create policy "suggestion images read" on public.suggestion_images
  for select to authenticated using (true);

drop policy if exists "suggestion images owner insert" on public.suggestion_images;
create policy "suggestion images owner insert" on public.suggestion_images
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "suggestion images owner or staff delete" on public.suggestion_images;
create policy "suggestion images owner or staff delete" on public.suggestion_images
  for delete to authenticated using (user_id = auth.uid() or public.is_staff());

/* Least privilege, matching migration 041: RLS policies are not the only
   control — the underlying grants are revoked too, so a policy mistake alone
   cannot open a write path. Every write to this table goes through a Server
   Action on the postgres role (DATABASE_URL), never the browser-shipped key.
   Without this, an owner could DELETE their own image row through PostgREST,
   bypassing both the thread-lock refusal in deleteSuggestionImageAction and
   the storage-object cleanup, and INSERT arbitrary rows onto another member's
   post past the 4-image cap. */
revoke insert, update, delete on public.suggestion_images from anon, authenticated;

commit;
