-- Preserve operational order records when an account is deleted while removing
-- the deleted user's auth identifier. This aligns self-service deletion with
-- staff deletion and keeps dispute/reconciliation history without an account FK.
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders alter column user_id drop not null;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
