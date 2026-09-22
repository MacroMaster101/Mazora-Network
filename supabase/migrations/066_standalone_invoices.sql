-- Let an invoice exist without a website order, and give it its own line items.
--
-- Most sales are arranged in Discord and never become an `orders` row, but the
-- buyer still needs a document. Invoices were modelled as strictly belonging to
-- an order, so there was no way to raise one for those sales.
--
-- Two changes:
--
--   1. order_id becomes nullable. A null order_id is a standalone invoice that
--      staff built by hand; a set one still links to the website order and
--      keeps reading its totals from there.
--
--   2. invoice_items holds the lines for standalone invoices. Order-backed
--      invoices continue to read order_items, so the figures on those cannot
--      drift from what the buyer was actually charged.
--
-- discount_percent is per line rather than per invoice because a Discord sale
-- often discounts one rank and not the crate keys beside it.

begin;

alter table public.order_invoices
  alter column order_id drop not null;

-- Who the standalone invoice is for; order-backed ones read the order instead.
alter table public.order_invoices
  add column if not exists buyer_name text,
  add column if not exists buyer_discord text;

-- The invoice form no longer asks for a currency label; the store prices in one
-- currency and the field only ever held a repeat of that. Dropped rather than
-- left behind, so it does not become another column nothing reads.
alter table public.order_invoices
  drop column if exists currency_label;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.order_invoices (id) on delete cascade,
  -- Nullable so deleting a product leaves the invoice line intact, matching
  -- how order_items keeps a name snapshot after a product is removed.
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null,
  discount_percent integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_items_quantity_positive check (quantity > 0),
  constraint invoice_items_price_nonneg check (unit_price >= 0),
  constraint invoice_items_discount_range check (discount_percent between 0 and 100)
);

create index if not exists invoice_items_invoice_idx
  on public.invoice_items (invoice_id, sort_order);

alter table public.invoice_items enable row level security;

commit;
