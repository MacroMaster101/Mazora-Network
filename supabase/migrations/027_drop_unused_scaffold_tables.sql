/*
  Drops the nine Phase-1 scaffold tables that no code path reads or writes.

  NOT SAFE TO RUN UNREVIEWED. Every table below was verified to have zero rows
  in production AND zero references anywhere in src/ (both Drizzle
  `schema.<table>` usage and Supabase `.from("<table>")` usage). What that
  verification CANNOT see is a writer outside this repository — the Minecraft
  server sync plugin is the obvious candidate, since it is the intended
  producer for player data. Confirm no external service writes these first.

  Dropping a table here without also removing it from src/lib/db/schema.ts
  leaves the Drizzle schema describing columns that no longer exist.

  Reversal: these are empty, so rollback is `git revert` on the schema plus
  re-running the original CREATE TABLE from 001_initial_schema.sql. No data is
  recoverable because there is none to recover — but take a backup anyway.
*/

begin;

-- Support intake. The ticket, appeal, player-report and bug-report pages under
-- /support are guide pages that hand the visitor off to a private Discord
-- ticket; none of them post to the database. Only /support/suggestions
-- persists, and it writes to `suggestions`, which is kept.
drop table if exists public.ticket_messages;
drop table if exists public.support_tickets;
drop table if exists public.ban_appeals;
drop table if exists public.player_reports;
drop table if exists public.bug_reports;

-- The public /staff page builds its roster from listPublicStaffAccounts()
-- (Supabase auth + profiles, filtered by role), never from this table.
drop table if exists public.staff_members;

-- The notifications feature is client-side only: src/lib/notifications-store.ts
-- is a "use client" module backed by localStorage with hardcoded defaults.
-- Nothing server-side ever wrote here.
drop table if exists public.notifications;

-- Event sign-ups were never built. `events` itself is kept — it is read by the
-- public events pages and the admin board.
drop table if exists public.event_registrations;

-- Superseded by `minecraft_players` (migration 024), which covers the same
-- ground with a wider scope: it keys on minecraft_uuid so it can hold players
-- who never made a website account, where this table keyed on
-- minecraft_account_id and could only ever describe linked accounts. The two
-- already duplicated playtime_seconds, balance, is_online and last_seen.
drop table if exists public.player_statistics;

commit;
