-- Restore row level security.
--
-- Background: this database's tables were created with `drizzle-kit push`, not
-- by migrations 000/001, so the policies those files declare were never
-- executed. An event trigger (rls_auto_enable) had switched RLS ON for every
-- table, and with zero policies that meant deny-all — the data was never
-- exposed, but the intended per-row rules did not exist either, leaving the
-- application code as the only thing enforcing access.
--
-- This migration re-creates them against the schema as it actually is. It is
-- deliberately NOT a replay of 000, which would fail or regress behaviour:
--   * 000 declares current_user_role() returning the enum public.user_role.
--     That type does not exist here — profiles.role is text.
--   * 000's is_staff()/is_admin() predate the sponsor/senior_moderator/it
--     ladder and would silently demote IT and Senior Moderators.
--   * 000 has a suggestions policy referencing suggestions.is_public, a column
--     that exists in neither the database nor the Drizzle schema.
--
-- Every statement is idempotent, so this is safe to re-run.

-- ---------------------------------------------------------------------------
-- Role helpers. Text-based, matching the live column type and current ladder.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role() returns text
language sql stable security definer set search_path=public as $$
  select role::text from public.profiles
  where user_id = auth.uid() and account_status::text = 'active'
  limit 1
$$;

-- Staff = helper and above. 'staff' is a legacy value kept for old rows.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(
    public.current_user_role() in
      ('staff','helper','moderator','senior_moderator','administrator','owner','it'),
    false)
$$;

-- Admin = administrator and above. 'it' is the highest rank and must be included;
-- omitting it (as the original migration did) would lock IT out of content tools.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(public.current_user_role() in ('administrator','owner','it'), false)
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS on (already enabled by the event trigger; restated for a fresh database).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','minecraft_accounts','minecraft_link_codes','player_statistics',
    'news_articles','game_modes','events','event_registrations','rule_categories',
    'rules','staff_members','support_tickets','ticket_messages','ban_appeals',
    'player_reports','bug_reports','suggestions','suggestion_votes','products',
    'orders','order_items','vote_sites','vote_history','notifications',
    'gallery_images','audit_logs','site_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Public/---owner read policies
-- ---------------------------------------------------------------------------
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles
  for select using (account_status::text = 'active');

-- A user may edit their own profile but never their own role.
drop policy if exists "profile owner update safe fields" on public.profiles;
create policy "profile owner update safe fields" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and role = (select p.role from public.profiles p where p.user_id = auth.uid()));

-- Minecraft mappings are personal data: owner and staff only.
drop policy if exists "minecraft account owner staff read" on public.minecraft_accounts;
create policy "minecraft account owner staff read" on public.minecraft_accounts
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

drop policy if exists "link codes owner read" on public.minecraft_link_codes;
create policy "link codes owner read" on public.minecraft_link_codes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "stats public read" on public.player_statistics;
create policy "stats public read" on public.player_statistics for select using (true);

drop policy if exists "published news public read" on public.news_articles;
create policy "published news public read" on public.news_articles
  for select using (status = 'published' or public.is_admin());

drop policy if exists "public modes read" on public.game_modes;
create policy "public modes read" on public.game_modes
  for select using (enabled or public.is_admin());

drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events
  for select using (status <> 'draft' or public.is_admin());

drop policy if exists "rules public read" on public.rules;
create policy "rules public read" on public.rules
  for select using (enabled or public.is_admin());

drop policy if exists "rule categories public read" on public.rule_categories;
create policy "rule categories public read" on public.rule_categories for select using (true);

drop policy if exists "staff profiles public read" on public.staff_members;
create policy "staff profiles public read" on public.staff_members
  for select using (visible or public.is_admin());

drop policy if exists "gallery public read" on public.gallery_images;
create policy "gallery public read" on public.gallery_images for select using (true);

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (enabled or public.is_admin());

drop policy if exists "vote sites public read" on public.vote_sites;
create policy "vote sites public read" on public.vote_sites
  for select using (enabled or public.is_admin());

-- ---------------------------------------------------------------------------
-- User-owned records
-- ---------------------------------------------------------------------------
drop policy if exists "registrations owner read" on public.event_registrations;
create policy "registrations owner read" on public.event_registrations
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "registrations owner insert" on public.event_registrations;
create policy "registrations owner insert" on public.event_registrations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "tickets private read" on public.support_tickets;
create policy "tickets private read" on public.support_tickets
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "tickets owner create" on public.support_tickets;
create policy "tickets owner create" on public.support_tickets
  for insert to authenticated with check (user_id = auth.uid());

-- Private staff notes stay invisible to the ticket's owner.
drop policy if exists "ticket messages private read" on public.ticket_messages;
create policy "ticket messages private read" on public.ticket_messages
  for select to authenticated using (
    (not is_private_staff_note and exists (
      select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or public.is_staff());
drop policy if exists "ticket messages owner reply" on public.ticket_messages;
create policy "ticket messages owner reply" on public.ticket_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and not is_private_staff_note and exists (
      select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
drop policy if exists "ticket staff message" on public.ticket_messages;
create policy "ticket staff message" on public.ticket_messages
  for insert to authenticated with check (public.is_staff() and sender_id = auth.uid());

drop policy if exists "appeals private" on public.ban_appeals;
create policy "appeals private" on public.ban_appeals
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "appeals owner create" on public.ban_appeals;
create policy "appeals owner create" on public.ban_appeals
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "reports private" on public.player_reports;
create policy "reports private" on public.player_reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_staff());
drop policy if exists "reports owner create" on public.player_reports;
create policy "reports owner create" on public.player_reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "bugs owner staff read" on public.bug_reports;
create policy "bugs owner staff read" on public.bug_reports
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "bugs create" on public.bug_reports;
create policy "bugs create" on public.bug_reports
  for insert to authenticated with check (user_id = auth.uid());

-- NOTE: the original migration gated this on suggestions.is_public, a column
-- that does not exist. Until a visibility flag is added, a suggestion is
-- readable by its author and staff only.
drop policy if exists "public suggestions read" on public.suggestions;
create policy "public suggestions read" on public.suggestions
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "suggestions create" on public.suggestions;
create policy "suggestions create" on public.suggestions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "votes public read" on public.suggestion_votes;
create policy "votes public read" on public.suggestion_votes for select using (true);
drop policy if exists "votes owner insert" on public.suggestion_votes;
create policy "votes owner insert" on public.suggestion_votes
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "votes owner delete" on public.suggestion_votes;
create policy "votes owner delete" on public.suggestion_votes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "orders private read" on public.orders;
create policy "orders private read" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "order items private read" on public.order_items;
create policy "order items private read" on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

drop policy if exists "vote history private" on public.vote_history;
create policy "vote history private" on public.vote_history
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications owner read" on public.notifications;
create policy "notifications owner read" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications owner update" on public.notifications;
create policy "notifications owner update" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The audit trail is a security record: admins read, nobody writes through PostgREST.
drop policy if exists "audit admin only" on public.audit_logs;
create policy "audit admin only" on public.audit_logs
  for select to authenticated using (public.is_admin());

-- site_settings is never world-readable; only the admin policy below reaches it.

-- ---------------------------------------------------------------------------
-- Admin content management
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'news_articles','game_modes','events','rule_categories','rules',
    'staff_members','products','vote_sites','gallery_images','site_settings'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'admin manage ' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      'admin manage ' || t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Signup trigger: guarantee a profile row at the database level rather than
-- relying solely on the application's ensureUserProfile() fallback.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (user_id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', 'New Player')
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: constrain writes to the owner's own folder.
--
-- Deliberately NO public "select" policy on storage.objects. The bucket is
-- public, so individual avatars are still served over /object/public/<path>,
-- but without a select policy the bucket cannot be enumerated — an anonymous
-- caller cannot list every user's folder (and therefore every user id).
-- ---------------------------------------------------------------------------
drop policy if exists "profile avatars owner insert" on storage.objects;
create policy "profile avatars owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile avatars owner update" on storage.objects;
create policy "profile avatars owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile avatars owner delete" on storage.objects;
create policy "profile avatars owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text);
