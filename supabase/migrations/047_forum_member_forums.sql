/*
 * Forums as a public meeting place.
 *
 * 1. forums.created_by — the member who started a forum. Null for staff-created
 *    and seeded forums. It backs the "by <member>" label on the board and the
 *    one-new-forum-per-day limit, which is counted from this column rather than
 *    a rate-limit store so it cannot be sidestepped by an unavailable cache.
 *    On delete set null: removing an account keeps the forum and its discussion,
 *    matching the retention policy migration 032 set for retained history.
 *
 * 2. A starter structure, so /forums is usable the moment it loads instead of
 *    showing an empty board until someone builds every shelf by hand. Member-
 *    created forums land in "Member Forums".
 *
 *    Every insert is ON CONFLICT (slug) DO NOTHING: it never duplicates a row,
 *    never overwrites a rename (slugs do not change on rename), and — being a
 *    migration — runs once, so a seeded forum an admin deletes stays deleted.
 *
 * No new table, so no RLS or grant change: forums already has RLS enabled and
 * browser-role writes revoked by migration 046, and a new column inherits both.
 */
begin;

alter table public.forums
  add column if not exists created_by uuid
  references auth.users(id) on delete set null;

create index if not exists forums_created_by_idx
  on public.forums (created_by, created_at);

insert into public.forum_categories (name, slug, description, sort_order) values
  ('Community',     'community',     'Talk with the rest of the network.',   0),
  ('Server',        'server',        'Game modes, events and builds.',       1),
  ('Support',       'support',       'Get help from players and staff.',     2),
  ('Member Forums', 'member-forums', 'Forums started by members.',           3)
on conflict (slug) do nothing;

insert into public.forums (category_id, name, slug, description, sort_order)
select c.id, v.name, v.slug, v.description, v.sort_order
from (values
  ('community', 'General Discussion', 'general-discussion', 'Anything and everything about Mazora.', 0),
  ('community', 'Introductions',      'introductions',      'New here? Say hello.',                  1),
  ('server',    'Game Modes',         'game-modes',         'Survival, Skyblock, Lifesteal and more.', 0),
  ('server',    'Events & Builds',    'events-and-builds',  'Share your builds and plan events.',    1),
  ('support',   'Help & Questions',   'help-and-questions', 'Ask the community for help.',           0)
) as v(category_slug, name, slug, description, sort_order)
join public.forum_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

commit;
