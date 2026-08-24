/*
  Closes the same anon-read hole on suggestion_votes that 029 closed on
  profiles.

  The existing policy (001, re-created in 008) is:

    create policy "votes public read" on public.suggestion_votes
      for select using (true);

  It names no role, so it grants SELECT to `anon` as well as `authenticated`.
  NEXT_PUBLIC_SUPABASE_ANON_KEY is shipped to every browser, so anyone can call
  PostgREST directly and page the whole table. suggestion_votes holds
  `user_id` (the internal auth.users UUID) alongside `suggestion_id`, so the
  open policy publishes which member voted on what — a member-activity and
  auth-id leak, exactly the class of bug 029 fixed for profiles.

  Nothing in the application relies on the anonymous grant. Vote insert/delete
  policies were already dropped in 018, so every write goes through the
  service-role client (which bypasses RLS); reads used by the app run through
  Drizzle on DATABASE_URL or the service role. There is no browser Supabase
  client anywhere in the codebase.

  The replacement lets a member read their own votes and lets staff read all —
  enough for any future authenticated browser client — while denying anon.
*/

begin;

drop policy if exists "votes public read" on public.suggestion_votes;

create policy "suggestion_votes self and staff read" on public.suggestion_votes
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

commit;
