-- Creator codes: record who the creator is and where to find them.
--
-- The Discord ID column added in 021 is replaced by a username: staff identify
-- creators by handle, not by snowflake, and nothing reads the ID. Dropping it is
-- safe because the feature has not shipped and the table carries no live rows.
--
-- Written idempotently so re-running it is a safe no-op, per docs/README.md.

alter table public.creator_codes add column if not exists discord_username text;

-- [{ "platform": "youtube", "url": "https://..." }]
-- URLs are validated to http(s) in the server action before they are stored.
alter table public.creator_codes
  add column if not exists socials jsonb not null default '[]'::jsonb;

alter table public.creator_codes drop column if exists discord_id;
