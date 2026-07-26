-- The store moves off the in-repo demo fixtures and into the database, so the
-- products table has to hold the whole product shape the storefront renders —
-- not just name/price/image. Everything here is additive and nullable so
-- existing rows stay valid.

alter table public.products add column if not exists features jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists accent text;
alter table public.products add column if not exists badge text;
alter table public.products add column if not exists family text;
alter table public.products add column if not exists billing text;
alter table public.products add column if not exists subcategory text;
alter table public.products add column if not exists sort_order integer not null default 0;

-- The storefront lists by category then position, and reads a single product by
-- slug; both paths deserve an index.
create index if not exists products_sort_idx on public.products (category, sort_order);
