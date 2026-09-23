-- Staff guide: the control-room boards (hrefs) this member was last shown.
--
-- Null means they have never seen the staff guide, so every existing staff
-- member gets it once. When their boards later grow (promotion, a new custom
-- role, a board granted on Permissions) the difference is shown as "New for
-- you". Written only by the markStaffGuideSeen server action (admin client),
-- which recomputes the list server-side.

alter table public.profiles add column if not exists staff_guide_boards text[];
