-- Staff-issued invoices for store orders.
--
-- Separate from `orders` because an order is the buyer's request and exists as
-- soon as they submit it, while an invoice is a document staff choose to issue
-- afterwards — most orders never get one.
--
-- No money is duplicated here. Subtotal, discount and total are always re-read
-- from the order and its line items so an invoice cannot drift from what was
-- actually charged. `adjustment` is the single figure staff add on top, stored
-- signed so a credit is simply a negative value.

begin;

create table if not exists public.order_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  invoice_no text not null,
  currency_label text,
  adjustment numeric(10, 2) not null default 0,
  notes text,
  billed_to text,
  issued_at timestamptz not null default now(),
  issued_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One invoice per order, so re-opening the dialog edits the existing document
-- rather than minting a second number for the same purchase.
create unique index if not exists order_invoices_order_idx
  on public.order_invoices (order_id);

create unique index if not exists order_invoices_invoice_no_idx
  on public.order_invoices (invoice_no);

-- Written only by the Store admin server actions, which authorise first.
alter table public.order_invoices enable row level security;

commit;
