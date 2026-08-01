-- Make every storefront-facing catalog field database-backed and manageable.
alter table public.game_modes
  add column if not exists icon text not null default 'gamepad-2',
  add column if not exists accent text not null default 'violet',
  add column if not exists tagline text,
  add column if not exists version text not null default '1.21.11',
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists commands jsonb not null default '[]'::jsonb,
  add column if not exists rules jsonb not null default '[]'::jsonb,
  add column if not exists store_status text not null default 'coming_soon',
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.products
  add column if not exists game_mode_slug text not null default 'survival-smp';

create index if not exists products_game_mode_slug_idx on public.products(game_mode_slug);
create index if not exists game_modes_store_order_idx on public.game_modes(sort_order);

insert into public.game_modes
  (name, slug, description, icon, accent, tagline, version, store_status, sort_order, enabled)
values
  ('Survival SMP', 'survival-smp', 'Mazora''s live Survival RPG marketplace.', 'gamepad-2', 'violet', 'Store live', '1.21.11', 'live', 0, true),
  ('Skyblock', 'skyblock', 'Skyblock marketplace opening in a future season.', 'gamepad-2', 'cyan', 'Coming soon', '1.21.11', 'coming_soon', 10, true),
  ('Lifesteal', 'lifesteal', 'Lifesteal marketplace opening in a future season.', 'gamepad-2', 'rose', 'Coming soon', '1.21.11', 'coming_soon', 20, true),
  ('OneBlock', 'oneblock', 'OneBlock marketplace opening in a future season.', 'gamepad-2', 'green', 'Coming soon', '1.21.11', 'coming_soon', 30, true),
  ('KitPvP', 'kitpvp', 'KitPvP marketplace opening in a future season.', 'gamepad-2', 'orange', 'Coming soon', '1.21.11', 'coming_soon', 40, true),
  ('Creative', 'creative', 'Creative marketplace opening in a future season.', 'gamepad-2', 'gold', 'Coming soon', '1.21.11', 'coming_soon', 50, true)
on conflict (slug) do update set
  name = excluded.name,
  description = coalesce(public.game_modes.description, excluded.description),
  icon = coalesce(public.game_modes.icon, excluded.icon),
  accent = coalesce(public.game_modes.accent, excluded.accent),
  tagline = coalesce(public.game_modes.tagline, excluded.tagline),
  version = coalesce(public.game_modes.version, excluded.version),
  store_status = excluded.store_status,
  sort_order = excluded.sort_order,
  enabled = true,
  updated_at = now();

