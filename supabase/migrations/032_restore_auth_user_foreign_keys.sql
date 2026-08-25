/*
  Restore the auth.users relationships that the original Drizzle schema push
  could not create. Migrations 001-005 were baselined without executing against
  the current database, so deleting an Auth user left public rows behind and
  permanently reserved profile/Minecraft usernames.

  Retention policy:
    - account-owned rows are deleted with the Auth user;
    - operational history is retained with its Auth id set null;
    - retained orders are scrubbed of Discord, Minecraft and free-text identity
      before the Auth id is nulled;
    - gallery reaction counters are repaired when a deleted user had likes.

  The cleanup runs before constraints are installed so this migration also
  repairs databases that already contain orphan rows. It is safe to re-run.
*/

begin;

-- Retained history: remove identity/attribution but keep the operational row.
update public.orders o
set user_id = null,
    discord_id = null,
    discord_username = null,
    minecraft_username = null,
    notes = null
where o.user_id is not null
  and not exists (select 1 from auth.users u where u.id = o.user_id);

update public.news_articles n
set author_id = null
where n.author_id is not null
  and not exists (select 1 from auth.users u where u.id = n.author_id);

update public.audit_logs a
set actor_id = null
where a.actor_id is not null
  and not exists (select 1 from auth.users u where u.id = a.actor_id);

update public.creator_codes c
set created_by = null
where c.created_by is not null
  and not exists (select 1 from auth.users u where u.id = c.created_by);

-- Account-owned rows: remove orphan children before parents. The extra parent
-- existence checks also repair public-to-public relationships missed by the
-- original schema push.
delete from public.gallery_likes gl
where not exists (select 1 from auth.users u where u.id = gl.user_id)
   or not exists (select 1 from public.gallery_images gi where gi.id = gl.image_id);

delete from public.suggestion_votes sv
where not exists (select 1 from auth.users u where u.id = sv.user_id)
   or not exists (select 1 from public.suggestions s where s.id = sv.suggestion_id)
   or exists (
     select 1
     from public.suggestions s
     where s.id = sv.suggestion_id
       and not exists (select 1 from auth.users u where u.id = s.user_id)
   );

delete from public.vote_history vh
where not exists (select 1 from auth.users u where u.id = vh.user_id)
   or not exists (select 1 from public.vote_sites vs where vs.id = vh.vote_site_id);

delete from public.suggestions s
where not exists (select 1 from auth.users u where u.id = s.user_id);

delete from public.gallery_images gi
where gi.author_id is not null
  and not exists (select 1 from auth.users u where u.id = gi.author_id);

delete from public.minecraft_accounts ma
where not exists (select 1 from auth.users u where u.id = ma.user_id);

delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.user_id);

-- Any orphan-like cleanup above can change the denormalized public count.
update public.gallery_images gi
set likes_count = (
  select count(*)::integer
  from public.gallery_likes gl
  where gl.image_id = gi.id
);

-- Recreate every current auth.users relationship with its deliberate deletion
-- rule. Dropping first also repairs a database that has the right constraint
-- name but the wrong ON DELETE action.
alter table public.profiles drop constraint if exists profiles_user_id_fkey;
alter table public.profiles
  add constraint profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.minecraft_accounts drop constraint if exists minecraft_accounts_user_id_fkey;
alter table public.minecraft_accounts
  add constraint minecraft_accounts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.suggestions drop constraint if exists suggestions_user_id_fkey;
alter table public.suggestions
  add constraint suggestions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.suggestion_votes drop constraint if exists suggestion_votes_user_id_fkey;
alter table public.suggestion_votes
  add constraint suggestion_votes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.suggestion_votes drop constraint if exists suggestion_votes_suggestion_id_fkey;
alter table public.suggestion_votes
  add constraint suggestion_votes_suggestion_id_fkey
  foreign key (suggestion_id) references public.suggestions(id) on delete cascade;

alter table public.vote_history drop constraint if exists vote_history_user_id_fkey;
alter table public.vote_history
  add constraint vote_history_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.vote_history drop constraint if exists vote_history_vote_site_id_fkey;
alter table public.vote_history
  add constraint vote_history_vote_site_id_fkey
  foreign key (vote_site_id) references public.vote_sites(id) on delete cascade;

alter table public.gallery_images drop constraint if exists gallery_images_author_id_fkey;
alter table public.gallery_images
  add constraint gallery_images_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete cascade;

alter table public.gallery_likes drop constraint if exists gallery_likes_user_id_fkey;
alter table public.gallery_likes
  add constraint gallery_likes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.news_articles drop constraint if exists news_articles_author_id_fkey;
alter table public.news_articles
  add constraint news_articles_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.audit_logs drop constraint if exists audit_logs_actor_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

alter table public.creator_codes drop constraint if exists creator_codes_created_by_fkey;
alter table public.creator_codes
  add constraint creator_codes_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- A BEFORE DELETE trigger is necessary for retained order columns: ON DELETE
-- SET NULL alone would remove the only key that can locate rows to anonymize.
-- It also removes the user's likes early and repairs the denormalized counters;
-- the FK cascade then has no reaction rows left to make those counts stale.
create or replace function public.prepare_account_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  affected_image_ids uuid[];
begin
  update public.orders
  set discord_id = null,
      discord_username = null,
      minecraft_username = null,
      notes = null
  where user_id = old.id;

  with removed as (
    delete from public.gallery_likes
    where user_id = old.id
    returning image_id
  )
  select coalesce(array_agg(distinct image_id), '{}'::uuid[])
  into affected_image_ids
  from removed;

  update public.gallery_images gi
  set likes_count = (
    select count(*)::integer
    from public.gallery_likes gl
    where gl.image_id = gi.id
  )
  where gi.id = any(affected_image_ids);

  return old;
end
$function$;

revoke all on function public.prepare_account_delete() from public;

drop trigger if exists prepare_public_data_before_auth_user_delete on auth.users;
create trigger prepare_public_data_before_auth_user_delete
  before delete on auth.users
  for each row execute function public.prepare_account_delete();

commit;
