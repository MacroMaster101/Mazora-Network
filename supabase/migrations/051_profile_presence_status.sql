/*
 * Member presence: a chosen status, and when the member was last actually
 * active (not just had a tab open).
 *
 *  - presence_status is what the member picked: online, idle, dnd, or
 *    invisible. Invisible members are never listed, and the heartbeat does not
 *    record their activity at all while they are invisible.
 *  - last_active_at moves only on a heartbeat from a tab the member has
 *    interacted with recently, so "online" decays to "idle" on its own.
 *
 * last_seen_at (migration 046) keeps its meaning: any heartbeat, active or not.
 * It was written for staff only; from here it is written for every member who
 * is not invisible, which is what "Who's online" needs.
 */
begin;

alter table public.profiles
  add column if not exists presence_status text not null default 'online';

alter table public.profiles
  add constraint profiles_presence_status_valid
  check (presence_status in ('online', 'idle', 'dnd', 'invisible'));

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- "Who's online" reads recent rows only.
create index if not exists profiles_last_seen_idx
  on public.profiles (last_seen_at desc)
  where last_seen_at is not null;

commit;
