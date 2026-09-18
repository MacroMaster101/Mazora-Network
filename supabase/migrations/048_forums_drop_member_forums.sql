/*
 * Forums are created by staff only (the Community Forums permission), so the
 * member-created forum support from migration 047 is withdrawn:
 *
 *  - the empty "Member Forums" category is removed. It is deleted only while
 *    it holds no forums, so a forum staff have since placed in it is never
 *    cascaded away with it;
 *  - forums.created_by and its index go with the feature that wrote them.
 *
 * The seeded Community / Server / Support structure from 047 stays.
 */
begin;

delete from public.forum_categories c
where c.slug = 'member-forums'
  and not exists (select 1 from public.forums f where f.category_id = c.id);

drop index if exists public.forums_created_by_idx;
alter table public.forums drop column if exists created_by;

commit;
