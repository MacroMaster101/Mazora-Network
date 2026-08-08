-- Adds storage for a self-uploaded skin, for players whose mc-heads.net
-- lookup returns nothing usable (offline/cracked accounts have no Mojang
-- account for mc-heads.net to look up, so it silently falls back to the
-- default Steve/Alex head).
--
-- skin_head_url is the processed 8x8-head-crop PNG that actually gets
-- rendered. raw_skin_url is the original uploaded skin file, kept so a
-- future change to the cropping logic never requires asking the user to
-- re-upload. Both live in the existing profile-avatars Storage bucket.

alter table public.minecraft_accounts
  add column if not exists skin_head_url text,
  add column if not exists raw_skin_url text;
