-- Closing an order ticket means the order was actually fulfilled, which is a
-- different thing from "staff accepted the request" (confirmed). Without a
-- separate value the admin board cannot tell a live order from a finished one,
-- so everything ever confirmed would sit in the queue forever.

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'rejected', 'awaiting_discord_join', 'completed'));
