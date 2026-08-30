/*
 * One-level reply nesting: a reply may point at a parent reply.
 *
 * Nullable, so every existing reply stays top-level with no backfill. The cap
 * at one level is enforced in the post action (a reply to a child re-points to
 * the top-level ancestor), not by the schema. on delete cascade matters only
 * for a hard delete — replies are soft-deleted — and is the coherent backstop:
 * if a reply's suggestion is hard-deleted (which already cascades), its child
 * replies go with it.
 */
begin;

alter table public.suggestion_replies
  add column if not exists parent_id uuid
  references public.suggestion_replies(id) on delete cascade;

create index if not exists suggestion_replies_parent_idx
  on public.suggestion_replies(parent_id) where parent_id is not null;

commit;
