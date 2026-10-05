-- Members may mark their own notifications read, nothing else.
--
-- The notifications_update_own policy (036) only pins the row to its owner
-- (user_id = auth.uid()), and `authenticated` still holds UPDATE on every
-- column. With the public Supabase key and their own session token, a member
-- could PATCH their own rows through the Data API and rewrite the title,
-- message, category, sender or href. A notification is staff-authored, so a
-- rewritten "from Mazora" message with a link of their choosing is a
-- convincing phishing prompt to show themselves in screenshots, and the sender
-- column would let it pose as staff.
--
-- Nothing in the app updates notifications as the member: marking read, bulk
-- delivery and clean-up all go through drizzle on the server's DATABASE_URL
-- connection (src/lib/actions/notifications.ts, src/lib/notifications-auto.ts),
-- which bypasses RLS and these grants. The only browser Supabase client is the
-- realtime listener, which never touches this table.
--
-- This revokes table-wide UPDATE from `authenticated` and grants it back on the
-- read marker only. The owner policy still applies on top, so a member can set
-- read_at on their own rows and nothing more. Select and delete grants, and
-- every policy, are unchanged. `anon` is not touched: no policy lets it update
-- a row here (the owner policy is for `authenticated` only).
--
-- Revoking the table privilege also drops any column-level update grant, so the
-- grant below is the whole list. Safe to re-run.

begin;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

commit;
