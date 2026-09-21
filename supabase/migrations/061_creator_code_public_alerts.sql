-- Add public storefront floating alert options to creator_codes.
--
-- Allows event codes and creator partner codes to be featured as a floating
-- discount cloud / alert across all public pages of the website.

begin;

alter table public.creator_codes
  add column if not exists show_public_alert boolean not null default false,
  add column if not exists alert_headline text,
  add column if not exists alert_badge text,
  add column if not exists alert_position text not null default 'bottom-right';

create index if not exists creator_codes_public_alert_idx
  on public.creator_codes (show_public_alert, enabled)
  where show_public_alert = true;

commit;
