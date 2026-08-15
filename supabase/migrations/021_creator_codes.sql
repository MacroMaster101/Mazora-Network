-- Creator discount codes: a vetted content creator gets a code their viewers
-- redeem for a percentage off a hand-picked set of products.
--
-- Written idempotently so re-running it is a safe no-op, per docs/README.md.

create table if not exists public.creator_codes (
  id uuid primary key default gen_random_uuid(),
  -- Normalised to uppercase by the server before every write and lookup, so a
  -- plain unique index is enough to stop NOVAPLAYS1 and novaplays1 co-existing.
  code text not null,
  creator_name text not null,
  discord_id text,
  percent_off integer not null,
  enabled boolean not null default true,
  expires_at timestamptz,
  internal_note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_codes_percent_range check (percent_off between 1 and 90)
);

create unique index if not exists creator_codes_code_idx
  on public.creator_codes(code);

-- The hand-picked eligibility list. A deleted product drops out of every code
-- automatically rather than leaving a dangling reference behind.
create table if not exists public.creator_code_products (
  code_id uuid not null references public.creator_codes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (code_id, product_id)
);

create index if not exists creator_code_products_product_idx
  on public.creator_code_products(product_id);

-- Order snapshot. total_amount keeps its meaning: what staff actually collect.
-- The subtotal and discount sit beside it so a past order stays auditable after
-- the code is edited or deleted.
alter table public.orders
  add column if not exists creator_code_id uuid references public.creator_codes(id) on delete set null;
alter table public.orders add column if not exists creator_code text;
alter table public.orders add column if not exists subtotal_amount numeric;
alter table public.orders add column if not exists discount_amount numeric not null default 0;

-- Reads and writes go through server code on DATABASE_URL. Browser PostgREST
-- clients intentionally get no policy: a code is semi-public, but its
-- eligibility list and internal note are not.
alter table public.creator_codes enable row level security;
alter table public.creator_code_products enable row level security;

drop policy if exists "creator codes public read" on public.creator_codes;
drop policy if exists "creator code products public read" on public.creator_code_products;
