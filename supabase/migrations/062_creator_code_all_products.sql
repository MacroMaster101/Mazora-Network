-- Make "this code applies to every product" an explicit, stored decision.
--
-- Eligibility used to be inferred from the creator_code_products join table:
-- an empty list meant "discounts nothing". A later change flipped that same
-- empty list to mean "discounts everything", which silently re-read two kinds
-- of pre-existing row as a sitewide discount of up to 90%:
--
--   * codes saved with no products picked, which the admin UI describes as
--     inert and therefore safe to leave enabled, and
--   * codes scoped to specific products whose join rows were later removed by
--     the `on delete cascade` on creator_code_products.product_id when a
--     product was deleted.
--
-- The flag below carries that intent explicitly instead. It defaults to false
-- and is deliberately NOT backfilled: every existing row keeps the old,
-- restrictive meaning, so no code becomes broader than it was when it was
-- created. Staff opt a code in from the Store admin.

begin;

alter table public.creator_codes
  add column if not exists applies_to_all_products boolean not null default false;

commit;
