/*
  Stops the whole user table being readable by anonymous callers.

  The existing policy is:

    create policy "profiles public read" on public.profiles
      for select using (account_status::text = 'active');

  It names no role, so it grants SELECT to `anon` as well as `authenticated`.
  NEXT_PUBLIC_SUPABASE_ANON_KEY is, by design, shipped to every browser, so
  anyone can call the PostgREST endpoint directly and page through every active
  profile. Verified against production: an anonymous request returned all 14
  profiles with id, user_id, username, display_name, avatar_url, bio, role,
  account_status, created_at and updated_at.

  No credentials are exposed by that — there are no emails or tokens on this
  table — but it publishes each member's internal auth id, their rank, and
  whether their account is active, for every account rather than only the staff
  the site chooses to display.

  Nothing in the application relies on the anonymous grant. There is no browser
  Supabase client anywhere in the codebase; every profile read runs either
  through the service-role client (which bypasses RLS entirely) or through
  Drizzle on DATABASE_URL. The public /staff page uses
  listPublicStaffAccounts(), which is service-role. The one call that does go
  through the session client is deleteAccountAction reading the caller's own
  row, and that is covered by the self-read below.

  Staff keep full read access so a future authenticated browser client, or any
  admin surface that stops using the service role, still works.
*/

begin;

drop policy if exists "profiles public read" on public.profiles;

create policy "profiles self and staff read" on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

commit;
