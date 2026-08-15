-- Reconcile the constraint and index layer that 001 declared but never created.
--
-- Migration 008 records the root cause plainly: "this database's tables were
-- created with `drizzle-kit push`, not by migrations 000/001, so the policies
-- those files declare were never executed." 014 confirms the same for columns.
-- The practical consequence is that almost everything 001 declares -- foreign
-- keys, unique constraints, CHECKs, and most indexes -- is absent from the live
-- database, because src/lib/db/schema.ts (which `db:push` actually shaped the
-- tables from) declares exactly one .references() in the whole file.
--
-- Everything below is written to be safely re-runnable and to cost nothing if
-- the object already exists:
--   * indexes use `if not exists`
--   * constraints are wrapped in an existence check
--   * foreign keys and CHECKs are added NOT VALID, so no full-table validating
--     scan is taken and the migration cannot fail on pre-existing bad rows;
--     new writes are constrained immediately
--   * the two UNIQUE indexes that could genuinely fail check for duplicates
--     first and skip with a NOTICE rather than aborting the migration
--
-- Run with:  npm run db:apply -- supabase/migrations/023_reconcile_constraints_and_indexes.sql
-- Do NOT run `npm run db:push` against production: schema.ts does not declare
-- these constraints, so push would propose dropping every one of them again.


-- ---------------------------------------------------------------------------
-- 1. Referential integrity
-- ---------------------------------------------------------------------------
-- order_items.order_id in particular: it has neither an FK nor an index, and it
-- is read on every /admin/orders render and every member's purchase history.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_order_id_fkey') then
    begin
      alter table public.order_items
        add constraint order_items_order_id_fkey
        foreign key (order_id) references public.orders(id) on delete cascade not valid;
    exception when others then
      raise notice 'SKIPPED order_items_order_id_fkey: %', sqlerrm;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_product_id_fkey') then
    begin
      alter table public.order_items
        add constraint order_items_product_id_fkey
        foreign key (product_id) references public.products(id) on delete set null not valid;
    exception when others then
      raise notice 'SKIPPED order_items_product_id_fkey: %', sqlerrm;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'rules_category_id_fkey') then
    begin
      alter table public.rules
        add constraint rules_category_id_fkey
        foreign key (category_id) references public.rule_categories(id) on delete cascade not valid;
    exception when others then
      raise notice 'SKIPPED rules_category_id_fkey: %', sqlerrm;
    end;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Money and quantity sanity
-- ---------------------------------------------------------------------------
-- All money columns are numeric (exact), never float -- but nothing currently
-- stops a negative total or a zero-quantity line from being written.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_quantity_positive') then
    alter table public.order_items
      add constraint order_items_quantity_positive check (quantity > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_price_nonneg') then
    alter table public.order_items
      add constraint order_items_price_nonneg check (price >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_amounts_nonneg') then
    alter table public.orders
      add constraint orders_amounts_nonneg
      check (
        total_amount >= 0
        and (subtotal_amount is null or subtotal_amount >= 0)
        and (discount_amount is null or discount_amount >= 0)
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_price_nonneg') then
    alter table public.products
      add constraint products_price_nonneg
      check (price >= 0 and (sale_price is null or sale_price >= 0)) not valid;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Status columns
-- ---------------------------------------------------------------------------
-- The content_status / ticket_status enums 001 declares were never created, so
-- these columns are plain unconstrained text. The allowed values below are
-- taken from what the application actually writes, NOT from the 001 enums --
-- news is written as 'hidden', 'rejected' and 'pending', none of which appear
-- in the content_status enum. NOT VALID so any pre-existing odd row survives;
-- validate only after confirming the live distinct values.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'news_articles_status_check') then
    alter table public.news_articles
      add constraint news_articles_status_check
      check (status in ('draft', 'pending', 'published', 'hidden', 'rejected')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'gallery_images_status_check') then
    alter table public.gallery_images
      add constraint gallery_images_status_check
      check (status in ('pending', 'published', 'rejected')) not valid;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 4. Missing indexes
-- ---------------------------------------------------------------------------

-- Hot path: batched line-item lookup for /admin/orders and purchase history.
-- Without this it is a sequential scan of the whole table on every render.
create index if not exists order_items_order_idx
  on public.order_items(order_id);

-- Member purchase history. Declared as orders_owner_idx in 001, never created.
create index if not exists orders_owner_idx
  on public.orders(user_id, created_at desc);

-- Discount-code attribution stats, and the ON DELETE SET NULL fired when a code
-- is deleted -- an unindexed FK child makes that delete scan the orders table.
create index if not exists orders_creator_code_idx
  on public.orders(creator_code_id)
  where creator_code_id is not null;

-- Public gallery feed: filtered by status, ordered by featured then recency.
create index if not exists gallery_images_feed_idx
  on public.gallery_images(status, featured desc, created_at desc);

-- The left join to profiles on both the public gallery and the admin board.
create index if not exists gallery_images_author_idx
  on public.gallery_images(author_id);

-- getRelatedArticles filters by category on every article page.
create index if not exists news_articles_category_idx
  on public.news_articles(category, published_at desc);

-- News list ordering is `coalesce(published_at, created_at) desc`; no plain
-- column index can serve that expression.
create index if not exists news_articles_pub_order_idx
  on public.news_articles((coalesce(published_at, created_at)) desc)
  where status = 'published';

-- Audit log feed. Declared as audit_logs_idx in 001, never created.
create index if not exists audit_logs_created_idx
  on public.audit_logs(created_at desc);

-- Unread notifications feed. Declared in 001, never created.
create index if not exists notifications_unread_idx
  on public.notifications(user_id, created_at desc)
  where read_at is null;

-- Top-voter aggregation. Declared as votes_owner_idx in 001, never created.
create index if not exists votes_owner_idx
  on public.vote_history(user_id, voted_at desc);

-- Rule ordering within a category. Declared as rules_order_idx in 001.
create index if not exists rules_order_idx
  on public.rules(category_id, sort_order);


-- ---------------------------------------------------------------------------
-- 5. Uniqueness that closes real races
-- ---------------------------------------------------------------------------
-- These two can legitimately fail if the data already contains duplicates, so
-- each checks first and skips with a NOTICE instead of aborting the migration.
-- If you see a NOTICE, reconcile the rows it names and re-run this file.

-- One Minecraft link per account. 001 declares user_id UNIQUE; the pushed
-- schema made it a NON-unique index, so an account can hold several rows --
-- and linkMinecraftUsernameAction uses .maybeSingle(), which ERRORS when more
-- than one row matches.
do $$
begin
  if exists (
    select 1 from public.minecraft_accounts
    where user_id is not null
    group by user_id having count(*) > 1
  ) then
    raise notice 'SKIPPED minecraft_accounts_user_idx: duplicate user_id rows exist. Reconcile with: select user_id, count(*) from public.minecraft_accounts group by 1 having count(*) > 1;';
  else
    create unique index if not exists minecraft_accounts_user_idx
      on public.minecraft_accounts(user_id);
  end if;
end $$;

-- getVoteSites() seeds four default rows from a READ path when the table is
-- empty, so two concurrent visitors to the public /vote page can both insert.
-- Nothing stops the duplicates today.
do $$
begin
  if exists (
    select 1 from public.vote_sites
    where url is not null
    group by url having count(*) > 1
  ) then
    raise notice 'SKIPPED vote_sites_url_idx: duplicate url rows exist. Reconcile with: select url, count(*) from public.vote_sites group by 1 having count(*) > 1;';
  else
    create unique index if not exists vote_sites_url_idx
      on public.vote_sites(url);
  end if;
end $$;

-- profiles.username is compared with ilike before writing, but the existing
-- unique index is case-SENSITIVE, so "Steve" and "steve" both pass the check
-- and only one can be stored.
do $$
begin
  if exists (
    select 1 from public.profiles
    where username is not null
    group by lower(username) having count(*) > 1
  ) then
    raise notice 'SKIPPED profiles_username_lower_idx: case-colliding usernames exist. Reconcile with: select lower(username), count(*) from public.profiles group by 1 having count(*) > 1;';
  else
    create unique index if not exists profiles_username_lower_idx
      on public.profiles(lower(username));
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 6. Money column precision
-- ---------------------------------------------------------------------------
-- 021 added subtotal_amount and discount_amount as bare `numeric` while
-- total_amount carries numeric(10,2). Exact either way, but the bare columns
-- accept sub-cent values a (10,2) sibling would reject. Guarded because
-- `alter type` errors if any existing value exceeds the new precision.

do $$
begin
  if exists (
    select 1 from public.orders
    where (subtotal_amount is not null and abs(subtotal_amount) >= 100000000)
       or (discount_amount is not null and abs(discount_amount) >= 100000000)
  ) then
    raise notice 'SKIPPED orders amount precision: a value exceeds numeric(10,2) range.';
  else
    alter table public.orders alter column subtotal_amount type numeric(10,2);
    alter table public.orders alter column discount_amount type numeric(10,2);
  end if;
end $$;
