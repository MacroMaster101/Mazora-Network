-- Event sign-ups.
--
-- 027 dropped the original scaffold table because nothing used it. Members can
-- now register for an event from its page (src/lib/actions/event-registrations.ts),
-- and the page lists who registered by their linked Minecraft name.
--
-- Only the server's DATABASE_URL connection reads or writes this table: the
-- register/leave actions check the session, the event's status, the player cap
-- and the linked Minecraft account first. RLS is on with no permissive policies
-- and the API roles hold no privileges, so it is unreachable through the Data
-- API. The two restrictive gates every table carries (072, 074) are added too.
--
-- Deleting an event or an account removes its registrations.
--
-- Safe to re-run.

begin;

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_registrations_event_user_unique unique (event_id, user_id)
);

create index if not exists event_registrations_user_idx on public.event_registrations (user_id);

alter table public.event_registrations enable row level security;
revoke all on public.event_registrations from anon, authenticated;

drop policy if exists "require two-step when enabled" on public.event_registrations;
create policy "require two-step when enabled" on public.event_registrations as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

drop policy if exists "suspended accounts are closed" on public.event_registrations;
create policy "suspended accounts are closed" on public.event_registrations as restrictive for all to authenticated
  using ((select public.account_usable())) with check ((select public.account_usable()));

commit;
