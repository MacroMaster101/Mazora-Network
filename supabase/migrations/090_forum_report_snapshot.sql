-- The reported post's text, kept on the report.
--
-- An author can edit a post after it has been reported, and the report kept
-- no copy of what was reported, so the text staff reviewed could be different
-- from the text the member flagged. reportForumPostAction now records the
-- post's body here when the report is filed, and the staff queue shows it when
-- it differs from the post's current text.
--
-- Nullable: reports filed before this migration have no snapshot, and the site
-- keeps filing reports without one until this has been applied.
--
-- Bounded to the same 8000 characters a post body may have (BODY_MAX in
-- src/lib/forums-rules.ts).
--
-- Readable by nobody but the server: forum_reports has had row level security
-- enabled with no policies since 046, so PostgREST serves none of its rows (and
-- so none of this column) to anon or authenticated, and the server reads it as
-- the postgres role for staff with the forums module only. Nothing here adds a
-- policy or a grant. RLS is not re-enabled here: it is already on, and turning
-- it on in a migration after 074 owes the restrictive gates (rls-gates.test.ts),
-- which a table with no permissive policy has no use for. The write revoke
-- from 046 is repeated, as it costs nothing.
--
-- Every statement is idempotent, so re-running this file changes nothing.

begin;

-- Altering the table waits for its lock; give up rather than queue reports
-- (and the staff queue) behind it.
set local lock_timeout = '5s';

alter table public.forum_reports
  add column if not exists reported_body text;

alter table public.forum_reports
  drop constraint if exists forum_reports_reported_body_length;

alter table public.forum_reports
  add constraint forum_reports_reported_body_length
  check (reported_body is null or char_length(reported_body) <= 8000);

revoke insert, update, delete on public.forum_reports from anon, authenticated;

commit;
