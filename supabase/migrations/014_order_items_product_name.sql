-- Reconcile order_items with the shape 001_initial_schema.sql always intended.
--
-- 001 declares `product_name text not null` and a nullable product_id, but the
-- live table has neither: the Drizzle schema omitted product_name and made
-- product_id NOT NULL, and `db:push` shaped the real table from that instead.
-- The drift only surfaced once anything actually read order lines.
--
-- Both changes matter for order history. A line item has to survive its product
-- being deleted or renamed, so the name is snapshotted at purchase time and
-- product_id is allowed to go null rather than cascading the row away.

alter table public.order_items
  add column if not exists product_name text;

-- Backfill from the live catalogue where the product still exists.
update public.order_items oi
   set product_name = p.name
  from public.products p
 where oi.product_id = p.id
   and oi.product_name is null;

-- Anything whose product is already gone keeps a readable placeholder.
update public.order_items
   set product_name = 'Unknown item'
 where product_name is null;

alter table public.order_items
  alter column product_name set not null;

-- A deleted product nulls the reference (matching the `on delete set null`
-- intent in 001) instead of being blocked by a NOT NULL constraint.
alter table public.order_items
  alter column product_id drop not null;
