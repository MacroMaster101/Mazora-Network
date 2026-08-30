/*
 * Least privilege for the browser-shipped roles on the suggestions feature.
 *
 * The anon key ships in the client bundle, so `anon` and any signed-in
 * member's `authenticated` role are reachable by anyone with curl. Reads are
 * already closed (every policy on these tables is `to authenticated` and the
 * data functions run on DATABASE_URL), but the table GRANTs underneath were
 * Supabase's permissive defaults, leaving two RLS policies as the only thing
 * standing between a member and a direct write:
 *
 *   - "replies owner insert"  WITH CHECK (user_id = auth.uid())
 *   - "replies owner update"  USING/CHECK (user_id = auth.uid() OR is_staff())
 *
 * Those check WHO is writing, never WHAT is written. A signed-in member
 * posting straight to PostgREST could therefore bypass every rule that lives
 * in postSuggestionReplyAction rather than in the schema:
 *
 *   - the one-level nesting cap — set parent_id to an already-nested reply and
 *     get a depth-2 row that effectiveParentId is designed to make impossible;
 *   - the thread lock — reply to, or edit inside, a thread locked for
 *     moderation;
 *   - the 10-per-minute rate limit;
 *   - the "edited" marker — UPDATE the body without touching edited_at, so the
 *     edit is silent;
 *   - deleted_at — clear it to restore a reply a moderator removed.
 *
 * Every write in this application goes through a Server Action on the postgres
 * role (DATABASE_URL), which bypasses RLS and these grants entirely; nothing
 * reaches these tables through PostgREST. Revoking therefore costs no code
 * path and makes the action the only door, which is what the design assumed
 * all along. Same posture as migrations 041 and 042.
 *
 * The SELECT grant stays: the policies already restrict it, and removing it
 * would change read behaviour rather than close a write hole.
 */
begin;

revoke insert, update, delete on
  public.suggestions,
  public.suggestion_replies,
  public.suggestion_votes,
  public.content_reports
from anon, authenticated;

commit;
