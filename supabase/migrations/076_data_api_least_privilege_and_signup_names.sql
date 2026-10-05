-- Five loose ends on the public Data API, and the sign-up name rules.
--
-- The publishable key and project URL are public, so any signed-in member can
-- call PostgREST and Supabase Auth directly with their own token. Everything
-- below closes something that only the app's own code was enforcing.
--
-- 1. Admin-rank read policies ignored the control panel's module permissions.
--    The "admin manage <table>" policies (008, and the 001 spellings on a
--    database built from the baseline) are FOR ALL using is_admin(), and the
--    public read policies carry an `or public.is_admin()` clause (008, 018).
--    Writes were already revoked in 041, but SELECT was not, so an
--    administrator an owner had removed from News, Gallery, Events, Store,
--    Rules or Voting could still read drafts, pending submissions and disabled
--    items straight from the Data API. 045 and 070 fixed the same pattern for
--    other tables.
--
--    The app never reads these tables as staff through a user session: admin
--    screens use DATABASE_URL or the service-role client. So the admin-manage
--    policies go, and each public read policy is recreated with exactly the
--    visibility rule it has today, minus the admin clause. rule_categories has
--    no admin clause (its read policy is `true`); only its unused admin-manage
--    policy is dropped.
--
-- 2. Write grants that rested on RLS alone. `anon` and `authenticated` still
--    held Supabase's default INSERT/UPDATE/DELETE on the tables below. No
--    policy allows those writes today, so nothing is exploitable yet, but one
--    over-broad policy added later would be live immediately. Every write in
--    the app goes through DATABASE_URL or the service role, so the grants are
--    removed, as 041, 043 and 046 did elsewhere. SELECT is left alone (the
--    dashboard falls back to an own-row read of minecraft_accounts), and so
--    are DELETE and the read_at UPDATE on notifications (036, 075). TRUNCATE
--    was already revoked everywhere in 057.
--
-- 3. Own-order reads returned staff-side columns. "orders owner read" (070)
--    pins the row to its owner, but a table-wide SELECT grant lets the owner
--    read every column: who handled the order, the private Discord ticket
--    channel id and the internal creator-code id. Nothing in the app reads
--    orders through a user session, so the table grant is replaced with a
--    column list that leaves those three out (same technique as 041). A column
--    added later is not exposed until someone grants it on purpose. id and
--    user_id stay granted: "order items owner read" looks them up. `anon` loses
--    its table-wide SELECT too and gets no column list: no policy lets a
--    signed-out visitor read an order, so the grant had nothing to serve.
--
-- 4. mfa_recovery_codes was created in 073, after 072's loop had run, so it is
--    the one RLS table without the two-step gate (074's loop did give it the
--    suspended-account gate). It has no permissive policy and no grants, so
--    this changes nothing reachable; it makes every table carry both gates.
--
-- 5. Direct sign-up skipped the app's name rules. handle_new_user (035) builds
--    the profile from raw_user_meta_data, which a caller of auth.signUp with
--    the public key controls. The form allows usernames of at most 16
--    characters and refuses display names containing control, invisible
--    formatting (zero-width, left/right override) or line/paragraph separator
--    characters (src/lib/validation/auth.ts); the database allowed 24 and
--    stored the display name as sent. The helpers now cap the username at 16
--    and strip those characters from the display name before trimming.
--
--    Trimming is spelled out as well. SQL trim() removes only the ordinary
--    space, so a name that was a single no-break or ideographic space was
--    stored as an invisible name, while the form trims every Unicode space.
--    The second pattern removes the same spaces from both ends (the rest of
--    what the form trims is already in the strip list), and a result shorter
--    than the form's minimum of 2 characters counts as empty, so the next
--    source, and finally the username, is used instead.
--
--    A trigger cannot refuse a name the way the form does without failing the
--    sign-up, so the characters are removed rather than rejected. The character
--    list is the Unicode categories Cc, Cf, Zl and Zp written out, because
--    Postgres regular expressions have no category classes. Existing profiles
--    are not rewritten, and the collision fallback in unique_username is
--    unchanged.
--
--    `create or replace` keeps a function's owner and grants but resets its
--    settings, so the `search_path = public` that 044 added is restated here.
--
-- The policy and grant changes take a brief exclusive lock on each table. A
-- short lock_timeout makes the migration fail fast (and roll back whole)
-- rather than wait behind a long transaction with every other query on that
-- table queued behind it.
--
-- Safe to re-run.

begin;

-- Give up after 5 seconds instead of queueing behind a long transaction on a busy table.
set local lock_timeout = '5s';

-- 1. Module permissions: drop the admin-rank policies, keep the public rule.
drop policy if exists "admin manage news" on public.news_articles;
drop policy if exists "admin manage news_articles" on public.news_articles;
drop policy if exists "admin manage gallery" on public.gallery_images;
drop policy if exists "admin manage gallery_images" on public.gallery_images;
drop policy if exists "admin manage events" on public.events;
drop policy if exists "admin manage modes" on public.game_modes;
drop policy if exists "admin manage game_modes" on public.game_modes;
drop policy if exists "admin manage rules" on public.rules;
drop policy if exists "admin manage rule categories" on public.rule_categories;
drop policy if exists "admin manage rule_categories" on public.rule_categories;
drop policy if exists "admin manage products" on public.products;
drop policy if exists "admin manage vote sites" on public.vote_sites;
drop policy if exists "admin manage vote_sites" on public.vote_sites;

drop policy if exists "published news public read" on public.news_articles;
create policy "published news public read" on public.news_articles
  for select using (status = 'published' and (published_at is null or published_at <= now()));

drop policy if exists "gallery public read" on public.gallery_images;
create policy "gallery public read" on public.gallery_images
  for select using (status = 'published');

drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events
  for select using (status <> 'draft');

drop policy if exists "public modes read" on public.game_modes;
create policy "public modes read" on public.game_modes
  for select using (enabled);

drop policy if exists "rules public read" on public.rules;
create policy "rules public read" on public.rules
  for select using (enabled);

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (enabled);

drop policy if exists "vote sites public read" on public.vote_sites;
create policy "vote sites public read" on public.vote_sites
  for select using (enabled);

-- 2. No browser-role writes where every write is a server action.
revoke insert, update, delete on
  public.orders,
  public.order_items,
  public.minecraft_accounts,
  public.vote_history,
  public.gallery_likes,
  public.creator_codes,
  public.creator_code_products,
  public.order_invoices,
  public.invoice_items
from anon, authenticated;

revoke insert on public.notifications from anon, authenticated;

-- 3. Own orders, minus handled_by, ticket_channel_id and creator_code_id.
--    Revoking the table privilege also drops any column-level select grant, so
--    the list below is the whole list.
revoke select on public.orders from anon, authenticated;
grant select (
  id, user_id, total_amount, reference, minecraft_username, discord_id,
  discord_username, notes, status, handled_at, creator_code, subtotal_amount,
  discount_amount, created_at
) on public.orders to authenticated;

-- 4. The two-step gate on the one table 072 could not have seen.
drop policy if exists "require two-step when enabled" on public.mfa_recovery_codes;
create policy "require two-step when enabled" on public.mfa_recovery_codes as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- 5. Sign-up names follow the form's limits.
create or replace function public.sanitize_username(candidate text)
returns text language sql immutable set search_path = public as $$
  select left(regexp_replace(coalesce(candidate, ''), '[^A-Za-z0-9_]', '', 'g'), 16);
$$;

create or replace function public.derive_display_name(meta jsonb, fallback_username text)
returns text language sql immutable set search_path = public as $$
  select left(coalesce(
    substring(regexp_replace(regexp_replace(meta->>'display_name', strip.chars, '', 'g'), strip.edges, '', 'g') from '^.{2,}$'),
    substring(regexp_replace(regexp_replace(meta->>'full_name', strip.chars, '', 'g'), strip.edges, '', 'g') from '^.{2,}$'),
    substring(regexp_replace(regexp_replace(meta->>'name', strip.chars, '', 'g'), strip.edges, '', 'g') from '^.{2,}$'),
    fallback_username
  ), 64)
  from (values (
    '[\u0001-\u001F\u007F-\u009F\u00AD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0001\U000E0020-\U000E007F]'::text,
    '^[\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+|[\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+$'::text
  )) as strip(chars, edges);
$$;

commit;
