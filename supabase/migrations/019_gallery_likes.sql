-- Reconcile the gallery reaction table with the checked-in Drizzle schema.
-- Likes are written only by the authenticated, rate-limited server action;
-- browser PostgREST clients intentionally receive no direct table policy.

create table if not exists public.gallery_likes (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.gallery_images(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists gallery_likes_user_image_idx
  on public.gallery_likes(user_id, image_id);

alter table public.gallery_likes enable row level security;

-- Remove legacy policies if the table was created manually in an earlier
-- environment. Server-side database access is unaffected by these removals.
drop policy if exists "gallery likes public read" on public.gallery_likes;
drop policy if exists "gallery likes owner insert" on public.gallery_likes;
drop policy if exists "gallery likes owner delete" on public.gallery_likes;
