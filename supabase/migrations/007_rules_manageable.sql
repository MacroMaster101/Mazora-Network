-- The rulebook moves into the database so staff can edit it from the admin
-- panel instead of it living in code. rule_categories needs the two fields the
-- public rulebook renders — an icon key and a genuine "last updated" stamp —
-- and rules need a slug-stable ordering per category.

alter table public.rule_categories add column if not exists icon text;
alter table public.rule_categories
  add column if not exists updated_at timestamptz not null default now();

-- One category per slug: the public page and the seeder both address by slug.
create unique index if not exists rule_categories_slug_idx on public.rule_categories (slug);

-- Editing a rule should bump its category's updated stamp, so the "Last updated"
-- date on the public page reflects reality rather than a hand-maintained value.
create or replace function public.touch_rule_category() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update public.rule_categories
     set updated_at = now()
   where id = coalesce(new.category_id, old.category_id);
  return coalesce(new, old);
end $$;

drop trigger if exists rules_touch_category on public.rules;
create trigger rules_touch_category
  after insert or update or delete on public.rules
  for each row execute function public.touch_rule_category();
