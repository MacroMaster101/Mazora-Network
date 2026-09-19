-- Default badge icons for the public ranks and Member.
--
-- 054 seeded VIP, Sponsor and Member without an icon; badges now show a role's
-- icon, so give them the same defaults the code's built-in catalogue uses.
-- Only rows still without an icon are touched, so an icon already picked on
-- the Roles page is kept.

begin;

update public.roles set icon = 'Gem', updated_at = now() where key = 'vip' and icon is null;
update public.roles set icon = 'Heart', updated_at = now() where key = 'sponsor' and icon is null;
update public.roles set icon = 'UserRound', updated_at = now() where key = 'member' and icon is null;

commit;
