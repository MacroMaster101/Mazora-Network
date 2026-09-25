-- Close direct suggestion-reply and content-report writes from the browser API.
--
-- Migration 038 gave members "replies owner insert" / "replies owner update"
-- and 039 gave them "reports owner insert". Those policies only pin the row's
-- owner, so with the public anon key and their own session token a member
-- could go around every check the app puts in front of the same writes:
--
--   * reply in a locked thread (the app's canPostReply refuses it);
--   * restore a reply a moderator removed, by PATCHing deleted_at back to null,
--     or move their reply onto another suggestion by changing suggestion_id;
--   * post replies and file reports with no rate limit.
--
-- Nothing in the app writes these tables as the member: replies and reports
-- go through the server's DATABASE_URL connection (src/lib/actions/
-- suggestions.ts, reports.ts), which these grants do not affect. Reads are
-- unchanged. Same fix as 042 (suggestion_images), 052 (comment votes) and 057
-- (profiles).

begin;

revoke insert, update, delete on public.suggestion_replies from anon, authenticated;
drop policy if exists "replies owner insert" on public.suggestion_replies;
drop policy if exists "replies owner update" on public.suggestion_replies;

revoke insert, update, delete on public.content_reports from anon, authenticated;
drop policy if exists "reports owner insert" on public.content_reports;

commit;
