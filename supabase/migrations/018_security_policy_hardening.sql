-- Security hardening for public content and the manual Store workflow.
--
-- Application writes for manual orders run through the validated server action
-- using the server-side database connection. Allowing authenticated PostgREST
-- clients to insert their own orders/items bypassed Discord verification,
-- server-side price calculation, rate limiting, and audit/workflow delivery.

drop policy if exists "orders owner insert" on public.orders;
drop policy if exists "order items owner insert" on public.order_items;

-- All user-generated forms currently go through authenticated server actions
-- that enforce field bounds, stable-account rate limits, and transactional
-- writes. Direct PostgREST mutation policies bypass those controls and are not
-- used by any checked-in browser client.
drop policy if exists "registrations owner insert" on public.event_registrations;
drop policy if exists "tickets owner create" on public.support_tickets;
drop policy if exists "ticket messages owner reply" on public.ticket_messages;
drop policy if exists "appeals owner create" on public.ban_appeals;
drop policy if exists "reports owner create" on public.player_reports;
drop policy if exists "bugs create" on public.bug_reports;
drop policy if exists "suggestions create" on public.suggestions;
drop policy if exists "votes owner insert" on public.suggestion_votes;
drop policy if exists "votes owner delete" on public.suggestion_votes;

-- Public pages obtain the small display subset they need through server-side
-- queries. A table-wide anon SELECT exposed immutable account ids, roles,
-- status, and timestamps alongside the intended username/avatar fields.
drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles owner staff read" on public.profiles;
create policy "profiles owner staff read" on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Pending/rejected gallery submissions are moderation data, not public
-- content. Administrators retain direct access for database tooling.
drop policy if exists "gallery public read" on public.gallery_images;
create policy "gallery public read" on public.gallery_images
  for select using (status = 'published' or public.is_admin());

-- A scheduled article is not public merely because its workflow status is
-- already "published". Match the application query's publication embargo.
drop policy if exists "published news public read" on public.news_articles;
create policy "published news public read" on public.news_articles
  for select using (
    (status = 'published' and (published_at is null or published_at <= now()))
    or public.is_admin()
  );
