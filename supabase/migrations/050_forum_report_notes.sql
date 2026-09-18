/*
 * Forum reports: an optional note from the reporter, and the same value rules
 * content_reports (migration 039) has always enforced, so a direct write
 * cannot store a reason or status the queue does not understand.
 *
 * Reports are filed against a post. Reporting the opening post is how a
 * member reports a topic, so topic_id stays unused but is kept for the
 * exactly-one-target constraint from 046.
 */
begin;

alter table public.forum_reports
  add column if not exists note text;

alter table public.forum_reports
  add constraint forum_reports_note_length
  check (note is null or char_length(note) between 1 and 1000);

alter table public.forum_reports
  add constraint forum_reports_reason_valid
  check (reason in ('spam', 'abuse', 'off_topic', 'duplicate', 'other'));

alter table public.forum_reports
  add constraint forum_reports_status_valid
  check (status in ('open', 'resolved', 'dismissed'));

-- The admin queue reads open reports newest first, and counts them per post.
create index if not exists forum_reports_open_idx
  on public.forum_reports (status, created_at desc);

commit;
