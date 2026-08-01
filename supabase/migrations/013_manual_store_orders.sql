-- Manual (Discord) store orders.
--
-- Orders were already being taken through the Discord flow, but nothing was
-- ever written down: the MZ-... reference existed only inside a Discord
-- message, so deleting that message destroyed the order. These columns give the
-- existing orders table everything the manual flow needs, so the site can show
-- a buyer their history and staff a real order list.
--
-- payment_status is deliberately left alone. It describes a future card
-- provider; `status` describes the manual workflow staff actually run, where
-- "confirmed" means staff accepted the request, NOT that money has been taken.

alter table public.orders
  add column if not exists reference text,
  add column if not exists minecraft_username text,
  add column if not exists discord_id text,
  add column if not exists discord_username text,
  add column if not exists notes text,
  add column if not exists status text not null default 'pending',
  add column if not exists handled_by text,
  add column if not exists handled_at timestamptz,
  add column if not exists ticket_channel_id text;

-- The reference is what a buyer quotes to staff, so it has to be unique.
-- Partial index: rows predating this migration have no reference.
create unique index if not exists orders_reference_idx
  on public.orders(reference) where reference is not null;

create index if not exists orders_status_idx on public.orders(status, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_status_check'
  ) then
    alter table public.orders
      add constraint orders_status_check
      check (status in ('pending', 'confirmed', 'rejected', 'awaiting_discord_join'));
  end if;
end $$;

-- Buyers insert their own order through the checkout form; staff never do.
-- Reads are already covered by the existing "orders private read" policy
-- (owner or admin), and updates stay server-side only.
drop policy if exists "orders owner insert" on public.orders;
create policy "orders owner insert" on public.orders
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "order items owner insert" on public.order_items;
create policy "order items owner insert" on public.order_items
  for insert to authenticated with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ));
