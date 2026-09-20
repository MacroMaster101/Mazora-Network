-- Standalone creator directory managed from the Community admin section.
-- This intentionally does not depend on Store discount codes: a creator may be
-- publicly featured without having a promotion, and a code may stay private.
create table if not exists public.content_creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  profile_image_url text,
  bio text,
  socials jsonb not null default '[]'::jsonb,
  public_visible boolean not null default true,
  featured_on_home boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_creators_name_length check (char_length(name) between 1 and 80),
  constraint content_creators_bio_length check (bio is null or char_length(bio) <= 180)
);

create index if not exists content_creators_public_idx
  on public.content_creators(featured_on_home desc, sort_order asc, created_at desc)
  where public_visible = true;

alter table public.content_creators enable row level security;

-- Public pages use the server database client. Browser clients must not read
-- or mutate the directory directly.
revoke all on table public.content_creators from anon, authenticated;
