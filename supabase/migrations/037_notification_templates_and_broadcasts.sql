/*
 * Notifications become a real, persisted admin module.
 *
 * Before this migration the admin Notifications screen kept its default
 * templates and its broadcast history in React state, so every edit was lost
 * on reload and the two "fixed default" templates (welcome, session
 * verification) were never wired to anything — no row was ever inserted, which
 * is why the header bell was empty for every account.
 *
 * Three changes:
 *   1. notification_templates  — the editable default templates, persisted.
 *   2. notification_broadcasts — the sent-broadcast history, so an admin can
 *      list, edit, and delete a broadcast after it was sent.
 *   3. notifications.broadcast_id — links a delivered notification back to the
 *      broadcast that produced it, so editing a broadcast rewrites what
 *      recipients see and deleting it withdraws the delivered copies.
 */
begin;

-- ---------------------------------------------------------------------------
-- 1. Default templates
-- ---------------------------------------------------------------------------
create table if not exists public.notification_templates (
  id text primary key,
  name text not null check (char_length(name) between 1 and 120),
  trigger_note text not null default '',
  title text not null check (char_length(title) between 1 and 140),
  message text not null check (char_length(message) between 1 and 2000),
  category text not null default 'system'
    check (category in ('welcome', 'system', 'support', 'security', 'announcement', 'event')),
  sender text not null default 'mazora'
    check (sender in ('mazora', 'staff', 'system')),
  delivery text not null default 'website'
    check (delivery in ('website', 'website_email')),
  -- Fixed templates fire automatically from an auth flow and cannot be
  -- dispatched by hand; only their text is editable.
  fixed boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.notification_templates
  (id, name, trigger_note, title, message, category, sender, delivery, fixed, enabled, sort_order)
values
  (
    'tpl-welcome',
    'New Player Welcome Message',
    'Automatically sent on first login via Website + Email. This is a fixed default — it cannot be manually dispatched and is delivered to every new user.',
    '🎉 Welcome to Mazora Network',
    'Your account is active. Connect to mc.mazora.us to claim your starter pack and explore survival mode!',
    'welcome', 'mazora', 'website_email', true, true, 10
  ),
  (
    'tpl-security',
    'Account Session Verification',
    'Automatically sent on first login or new device session via Website only. Fixed default — fires automatically.',
    '🔒 Session Verification',
    'Your login session was verified successfully. If you suspect unauthorized activity, change your password in account settings.',
    'security', 'mazora', 'website', true, true, 20
  ),
  (
    'tpl-form',
    'Form Response / Staff Application Result',
    'Admin dispatches manually after reviewing Google Form staff applications or other user submissions.',
    '📋 Staff Form Application Update',
    'Your application form submission has been reviewed by the administrative team. Check Discord for next steps!',
    'support', 'mazora', 'website', false, true, 30
  ),
  (
    'tpl-ticket',
    'Support Ticket Status Update / Staff Reply',
    'Admin dispatches manually when staff responds to or resolves a ticket thread.',
    '🎫 Support Ticket Update',
    'A staff member has updated your ticket status. Click here to view the full response.',
    'support', 'mazora', 'website', false, true, 40
  ),
  (
    'tpl-appeal',
    'Ban Appeal Decision Notice',
    'Admin dispatches manually when an appeal is approved, rejected, or updated.',
    '🛡️ Appeal Review Notice',
    'Your punishment appeal has been reviewed by staff. Click to view the decision details.',
    'support', 'mazora', 'website', false, true, 50
  ),
  (
    'tpl-store',
    'Store Package & Rank Delivery',
    'Admin dispatches manually when a store purchase or vote reward is processed.',
    '🛒 Store Package Delivered',
    'Your rank, keys, and perks have been assigned to your connected Minecraft account!',
    'system', 'mazora', 'website', false, true, 60
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Broadcast history
-- ---------------------------------------------------------------------------
create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  message text not null check (char_length(message) between 1 and 2000),
  audience text not null default 'all'
    check (audience in ('all', 'staff', 'moderators', 'users')),
  category text not null default 'announcement'
    check (category in ('welcome', 'system', 'support', 'security', 'announcement', 'event')),
  sender text not null default 'mazora'
    check (sender in ('mazora', 'staff', 'system')),
  priority text not null default 'normal'
    check (priority in ('normal', 'important', 'urgent')),
  href text,
  delivered integer not null default 0,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_broadcasts_created_idx
  on public.notification_broadcasts(created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Link delivered notifications back to their broadcast
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists broadcast_id uuid
  references public.notification_broadcasts(id) on delete cascade;

create index if not exists notifications_broadcast_idx
  on public.notifications(broadcast_id) where broadcast_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Both tables are staff-facing configuration reached only through the server's
-- DATABASE_URL connection. Enabling RLS with an admin-only policy keeps them
-- unreachable through PostgREST for everyone else, matching site_settings.
-- ---------------------------------------------------------------------------
alter table public.notification_templates enable row level security;
alter table public.notification_broadcasts enable row level security;

drop policy if exists "admin manage notification_templates" on public.notification_templates;
create policy "admin manage notification_templates" on public.notification_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage notification_broadcasts" on public.notification_broadcasts;
create policy "admin manage notification_broadcasts" on public.notification_broadcasts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

commit;
