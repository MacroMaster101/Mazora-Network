-- Mazora Network core schema. Run with the Supabase CLI, then review policies against your staff workflow.
create extension if not exists pgcrypto;

create type public.user_role as enum ('member','vip','staff','moderator','administrator','owner');
create type public.account_status as enum ('active','suspended','deleted');
create type public.content_status as enum ('draft','published','archived');
create type public.ticket_status as enum ('open','staff_replied','user_replied','in_progress','resolved','closed');
create type public.case_status as enum ('pending','under_review','approved','denied','closed');

create table public.profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'), display_name text not null,
  avatar_url text, bio text check (char_length(bio)<=500), role public.user_role not null default 'member',
  account_status public.account_status not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.minecraft_accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  minecraft_uuid uuid not null unique, minecraft_username text not null check (minecraft_username ~ '^[A-Za-z0-9_]{3,16}$'),
  linked_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.minecraft_link_codes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now(),
  constraint valid_expiry check (expires_at>created_at)
);
create unique index one_active_link_code_per_user on public.minecraft_link_codes(user_id) where used_at is null;
create table public.player_statistics (
  id uuid primary key default gen_random_uuid(), minecraft_account_id uuid not null unique references public.minecraft_accounts(id) on delete cascade,
  playtime_seconds bigint not null default 0 check (playtime_seconds>=0), kills integer not null default 0, deaths integer not null default 0,
  balance numeric(14,2) not null default 0, level integer not null default 1, wins integer not null default 0, losses integer not null default 0,
  blocks_mined bigint not null default 0, blocks_placed bigint not null default 0, last_seen timestamptz, is_online boolean not null default false,
  current_game_mode text, updated_at timestamptz not null default now()
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, excerpt text not null,
  content text not null, featured_image text, category text not null, status public.content_status not null default 'draft',
  author_id uuid references auth.users(id) on delete set null, seo_title text, meta_description text,
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index news_published_idx on public.news_articles(published_at desc) where status='published';
create table public.game_modes (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text not null, image_url text,
  server_address text, player_count integer not null default 0, supported_version text, features jsonb not null default '[]', enabled boolean not null default true
);
create table public.events (
  id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, description text not null, image_url text,
  start_at timestamptz not null, end_at timestamptz not null, status text not null default 'upcoming', game_mode text, rewards text,
  rules jsonb not null default '[]', max_participants integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint event_dates check (end_at>start_at)
);
create index events_start_idx on public.events(start_at);
create table public.event_registrations (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, registered_at timestamptz not null default now(), unique(event_id,user_id)
);
create table public.rule_categories (id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique, sort_order integer not null default 0);
create table public.rules (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.rule_categories(id) on delete cascade,
  title text not null, description text not null, sort_order integer not null default 0, enabled boolean not null default true, updated_at timestamptz not null default now()
);
create index rules_order_idx on public.rules(category_id,sort_order);
create table public.staff_members (
  id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id) on delete cascade,
  minecraft_account_id uuid references public.minecraft_accounts(id) on delete set null, staff_role text not null, bio text,
  sort_order integer not null default 0, visible boolean not null default true
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, subject text not null, priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
  status public.ticket_status not null default 'open', assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index tickets_owner_idx on public.support_tickets(user_id,updated_at desc);
create index tickets_queue_idx on public.support_tickets(status,priority,updated_at desc);
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade, message text not null check(char_length(message) between 1 and 10000),
  is_private_staff_note boolean not null default false, created_at timestamptz not null default now()
);
create index ticket_messages_idx on public.ticket_messages(ticket_id,created_at);
create table public.ban_appeals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  minecraft_username text not null, punishment_type text not null, punishment_reason text, appeal_text text not null, evidence_url text,
  status public.case_status not null default 'pending', reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_open_appeal_per_user on public.ban_appeals(user_id) where status in ('pending','under_review');
create table public.player_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_username text not null, category text not null, description text not null, evidence_url text,
  status text not null default 'submitted', assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bug_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null,
  game_mode text, description text not null, reproduction_steps text not null, expected_result text, actual_result text,
  minecraft_version text, evidence_url text, status text not null default 'submitted', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.suggestions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, category text not null, description text not null, status text not null default 'submitted',
  is_public boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.suggestion_votes (
  id uuid primary key default gen_random_uuid(), suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(suggestion_id,user_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text not null, category text not null,
  price numeric(10,2) not null check(price>=0), sale_price numeric(10,2) check(sale_price>=0), image_url text,
  enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  total_amount numeric(10,2) not null check(total_amount>=0), payment_status text not null default 'pending', payment_provider text,
  external_payment_id text unique, created_at timestamptz not null default now()
);
create index orders_owner_idx on public.orders(user_id,created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null, quantity integer not null check(quantity>0), price numeric(10,2) not null check(price>=0)
);
create table public.vote_sites (
  id uuid primary key default gen_random_uuid(), name text not null, url text not null, image_url text, reward_description text not null,
  cooldown_hours integer not null default 24, enabled boolean not null default true
);
create table public.vote_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  vote_site_id uuid not null references public.vote_sites(id) on delete cascade, voted_at timestamptz not null default now()
);
create index votes_owner_idx on public.vote_history(user_id,voted_at desc);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, message text not null, type text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create table public.gallery_images (
  id uuid primary key default gen_random_uuid(), title text not null, image_url text not null, category text not null,
  uploaded_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  action text not null, target_type text not null, target_id text, metadata jsonb not null default '{}', ip_address inet,
  created_at timestamptz not null default now()
);
create index audit_logs_idx on public.audit_logs(created_at desc,actor_id);
create table public.site_settings (
  id uuid primary key default gen_random_uuid(), setting_key text not null unique, setting_value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);

create or replace function public.current_user_role() returns public.user_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where user_id=auth.uid() and account_status='active' limit 1
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_user_role() in ('staff','moderator','administrator','owner'),false)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_user_role() in ('administrator','owner'),false)
$$;
revoke all on function public.current_user_role() from public; grant execute on function public.current_user_role() to authenticated;
revoke all on function public.is_staff() from public; grant execute on function public.is_staff() to authenticated;
revoke all on function public.is_admin() from public; grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security; alter table public.minecraft_accounts enable row level security; alter table public.minecraft_link_codes enable row level security;
alter table public.player_statistics enable row level security; alter table public.news_articles enable row level security; alter table public.game_modes enable row level security;
alter table public.events enable row level security; alter table public.event_registrations enable row level security; alter table public.rule_categories enable row level security;
alter table public.rules enable row level security; alter table public.staff_members enable row level security; alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security; alter table public.ban_appeals enable row level security; alter table public.player_reports enable row level security;
alter table public.bug_reports enable row level security; alter table public.suggestions enable row level security; alter table public.suggestion_votes enable row level security;
alter table public.products enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security;
alter table public.vote_sites enable row level security; alter table public.vote_history enable row level security; alter table public.notifications enable row level security;
alter table public.gallery_images enable row level security; alter table public.audit_logs enable row level security; alter table public.site_settings enable row level security;

create policy "profiles public read" on public.profiles for select using(account_status='active');
create policy "profile owner update safe fields" on public.profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and role=(select role from public.profiles where user_id=auth.uid()));
create policy "minecraft account public read" on public.minecraft_accounts for select using(true);
create policy "link codes owner read" on public.minecraft_link_codes for select to authenticated using(user_id=auth.uid());
create policy "stats public read" on public.player_statistics for select using(true);
create policy "published news public read" on public.news_articles for select using(status='published' or public.is_admin());
create policy "public modes read" on public.game_modes for select using(enabled or public.is_admin());
create policy "events public read" on public.events for select using(true); create policy "rules public read" on public.rules for select using(enabled or public.is_admin());
create policy "rule categories public read" on public.rule_categories for select using(true); create policy "staff profiles public read" on public.staff_members for select using(visible or public.is_admin());
create policy "registrations owner read" on public.event_registrations for select to authenticated using(user_id=auth.uid() or public.is_staff());
create policy "registrations owner insert" on public.event_registrations for insert to authenticated with check(user_id=auth.uid());
create policy "tickets private read" on public.support_tickets for select to authenticated using(user_id=auth.uid() or public.is_staff());
create policy "tickets owner create" on public.support_tickets for insert to authenticated with check(user_id=auth.uid());
create policy "ticket messages private read" on public.ticket_messages for select to authenticated using((not is_private_staff_note and exists(select 1 from public.support_tickets t where t.id=ticket_id and t.user_id=auth.uid())) or public.is_staff());
create policy "ticket messages owner reply" on public.ticket_messages for insert to authenticated with check(sender_id=auth.uid() and not is_private_staff_note and exists(select 1 from public.support_tickets t where t.id=ticket_id and t.user_id=auth.uid()));
create policy "ticket staff message" on public.ticket_messages for insert to authenticated with check(public.is_staff() and sender_id=auth.uid());
create policy "appeals private" on public.ban_appeals for select to authenticated using(user_id=auth.uid() or public.is_staff()); create policy "appeals owner create" on public.ban_appeals for insert to authenticated with check(user_id=auth.uid());
create policy "reports private" on public.player_reports for select to authenticated using(reporter_id=auth.uid() or public.is_staff()); create policy "reports owner create" on public.player_reports for insert to authenticated with check(reporter_id=auth.uid());
create policy "bugs owner staff read" on public.bug_reports for select to authenticated using(user_id=auth.uid() or public.is_staff()); create policy "bugs create" on public.bug_reports for insert to authenticated with check(user_id=auth.uid());
create policy "public suggestions read" on public.suggestions for select using(is_public or user_id=auth.uid() or public.is_staff()); create policy "suggestions create" on public.suggestions for insert to authenticated with check(user_id=auth.uid());
create policy "votes public read" on public.suggestion_votes for select using(true); create policy "votes owner insert" on public.suggestion_votes for insert to authenticated with check(user_id=auth.uid()); create policy "votes owner delete" on public.suggestion_votes for delete to authenticated using(user_id=auth.uid());
create policy "products public read" on public.products for select using(enabled or public.is_admin());
create policy "orders private read" on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin()); create policy "order items private read" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
create policy "vote sites public read" on public.vote_sites for select using(enabled or public.is_admin()); create policy "vote history private" on public.vote_history for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "notifications owner read" on public.notifications for select to authenticated using(user_id=auth.uid()); create policy "notifications owner update" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "gallery public read" on public.gallery_images for select using(true); create policy "audit admin only" on public.audit_logs for select to authenticated using(public.is_admin()); create policy "settings public read" on public.site_settings for select using(true);

-- All content-management mutations are limited to admins. Service-role integrations bypass RLS by design and must remain server-side.
create policy "admin manage news" on public.news_articles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage modes" on public.game_modes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage events" on public.events for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage rule categories" on public.rule_categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage rules" on public.rules for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage staff" on public.staff_members for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage products" on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage vote sites" on public.vote_sites for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage gallery" on public.gallery_images for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manage settings" on public.site_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(user_id,username,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'username','player_'||substr(new.id::text,1,8)),coalesce(new.raw_user_meta_data->>'display_name','New Player')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
