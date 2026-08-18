-- Complete Minecraft player registry. Rows are written by whichever server-side
-- sync source is wired up later; the table itself is source-agnostic.
-- This intentionally does not reuse minecraft_accounts: only players who link
-- a website account appear there, while public rankings include everyone who
-- has joined the Minecraft server.

create table if not exists public.minecraft_players (
  id uuid primary key default gen_random_uuid(),
  minecraft_uuid text not null,
  username text not null,
  playtime_seconds bigint,
  balance numeric(18,2),
  is_online boolean not null default false,
  first_joined timestamptz,
  last_seen timestamptz,
  server_name text,
  synced_at timestamptz not null default now(),
  constraint minecraft_players_playtime_nonnegative
    check (playtime_seconds is null or playtime_seconds >= 0) not valid
);

create unique index if not exists minecraft_players_uuid_idx
  on public.minecraft_players(minecraft_uuid);

create index if not exists minecraft_players_username_idx
  on public.minecraft_players(lower(username));

create index if not exists minecraft_players_online_idx
  on public.minecraft_players(is_online, synced_at desc);

create index if not exists minecraft_players_playtime_idx
  on public.minecraft_players(playtime_seconds desc nulls last);

create index if not exists minecraft_players_balance_idx
  on public.minecraft_players(balance desc nulls last);

-- This table is written and read only by trusted server-side database
-- connections. Browser Supabase clients must never be able to forge rankings.
alter table public.minecraft_players enable row level security;
revoke all on table public.minecraft_players from anon, authenticated;

