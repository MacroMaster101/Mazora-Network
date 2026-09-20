-- Profile photos and Minecraft skins are decoded, sanitised, rate-limited and
-- written by server actions using the service-role client. Direct browser
-- Storage writes bypass all of those controls and let any authenticated account
-- create unlimited public objects (or replace its current sanitized avatar).
--
-- The service role bypasses storage RLS, so removing these policies does not
-- affect any legitimate application upload, switch, cleanup, or account-delete
-- path. Public object delivery is a bucket property and remains unchanged.

begin;

drop policy if exists "profile avatars owner insert" on storage.objects;
drop policy if exists "profile avatars owner update" on storage.objects;
drop policy if exists "profile avatars owner delete" on storage.objects;

commit;
