-- Close two ways around the app's permissions through the public PostgREST /
-- Storage APIs (the anon key and project URL are public, so any signed-in user
-- can call them directly with their own access token).
--
-- 1. Staff-wide SELECT policies ignored the admin panel's module permissions.
--    `is_staff()` / `is_admin()` let any Helper read every profile's status and
--    activity, every Minecraft link, and every suggestion vote, and let an
--    administrator an owner had removed from Orders still read every order
--    (buyer Discord IDs, Minecraft names, notes). Migration 045 fixed the same
--    pattern for settings, notifications and audit logs.
--
--    The app never reads other users' rows of these tables through a user
--    session: staff screens use the service-role client or DATABASE_URL, and
--    the only session-client reads (account deletion, the dashboard fallbacks)
--    are the caller's own row. So each table keeps a self-read policy and
--    loses the staff clause.
--
-- 2. "profile avatars public read" (migration 003) let anyone LIST the
--    profile-avatars bucket, revealing every account's internal user id.
--    Migration 008 meant to remove it ("Deliberately NO public 'select'
--    policy") but never dropped it. The bucket is public, so avatar and skin
--    URLs keep working without a SELECT policy; every list/upload/remove in
--    the app goes through the service role.

begin;

drop policy if exists "profiles owner staff read" on public.profiles;
drop policy if exists "profiles self and staff read" on public.profiles;
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "minecraft account owner staff read" on public.minecraft_accounts;
drop policy if exists "minecraft account owner read" on public.minecraft_accounts;
create policy "minecraft account owner read" on public.minecraft_accounts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "orders private read" on public.orders;
drop policy if exists "orders owner read" on public.orders;
create policy "orders owner read" on public.orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "order items private read" on public.order_items;
drop policy if exists "order items owner read" on public.order_items;
create policy "order items owner read" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists "public suggestions read" on public.suggestions;
drop policy if exists "suggestions owner read" on public.suggestions;
create policy "suggestions owner read" on public.suggestions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "suggestion_votes self and staff read" on public.suggestion_votes;
drop policy if exists "suggestion_votes self read" on public.suggestion_votes;
create policy "suggestion_votes self read" on public.suggestion_votes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "vote history private" on public.vote_history;
drop policy if exists "vote history owner read" on public.vote_history;
create policy "vote history owner read" on public.vote_history
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "profile avatars public read" on storage.objects;

commit;
