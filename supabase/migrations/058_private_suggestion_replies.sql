-- Stop the browser API reading suggestion replies and images directly.
--
-- "replies public read" and "suggestion images read" let any signed-in member
-- select every row through the Supabase REST API with the public key — including
-- the body and author of replies that were deleted (deleted_at set), which the
-- site deliberately never sends to the browser, and images on suggestions they
-- cannot otherwise see.
--
-- The site reads these tables only on the server (service role / DATABASE_URL),
-- which RLS does not restrict, and they are not in the realtime publication, so
-- nothing in the app depends on these policies. With RLS on and no policy, the
-- API roles simply see no rows.

begin;

drop policy if exists "replies public read" on public.suggestion_replies;
drop policy if exists "suggestion images read" on public.suggestion_images;

commit;
