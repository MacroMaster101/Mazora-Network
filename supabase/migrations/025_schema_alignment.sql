-- Align the live database with src/lib/db/schema.ts after the constraint and
-- index reconciliation in migration 023.

-- All current gallery rows have an image URL. Enforce the application contract
-- before removing the empty legacy uploader column superseded by author_id.
alter table public.gallery_images
  alter column image_url set not null;

alter table public.gallery_images
  drop column if exists uploaded_by;

-- Migration 023 installed these as NOT VALID so existing rows could be audited
-- without blocking deployment. Current production data satisfies every check.
alter table public.order_items validate constraint order_items_order_id_fkey;
alter table public.order_items validate constraint order_items_product_id_fkey;
alter table public.rules validate constraint rules_category_id_fkey;
alter table public.order_items validate constraint order_items_quantity_positive;
alter table public.order_items validate constraint order_items_price_nonneg;
alter table public.orders validate constraint orders_amounts_nonneg;
alter table public.products validate constraint products_price_nonneg;
alter table public.news_articles validate constraint news_articles_status_check;
alter table public.gallery_images validate constraint gallery_images_status_check;

-- The unique replacement is the canonical one-account/one-link index.
drop index if exists public.mc_accounts_user_idx;
