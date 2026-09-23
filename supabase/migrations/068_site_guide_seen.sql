-- Site guide: when the member first closed the welcome guide.
--
-- Null means they have not seen it. Every existing row starts null on purpose,
-- so members who signed up before the guide existed get it once too.
-- Written only by the markSiteGuideSeen server action (admin client), and only
-- while still null, so the value is the first dismissal.

alter table public.profiles add column if not exists site_guide_seen_at timestamptz;
