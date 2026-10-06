-- When the account was welcomed (welcome notification + welcome email).
--
-- The welcome used to be "sent once" by checking for an existing welcome
-- notification. Notifications are not permanent: the reaper deletes read ones
-- after 30 days (src/lib/data/cleanup-notifications.ts) and members can delete
-- their own, so the next sign-in found none and welcomed the account again,
-- email included. The account itself now records it, and
-- dispatchWelcomeNotification claims it with one conditional update
-- (`... where welcomed_at is null`), so concurrent sign-ins cannot both send it.
--
-- Backfilled for every account that was already welcomed, or that has signed
-- in before (the welcome is sent on sign-in, so they have had it), so nobody is
-- welcomed again by this change. Accounts that have never signed in stay null
-- and are welcomed on their first sign-in, as before.
--
-- Written only by the server (DATABASE_URL); browser roles cannot write profiles (057).
--
-- Safe to re-run.

alter table public.profiles add column if not exists welcomed_at timestamptz;

update public.profiles p
set welcomed_at = coalesce(
  (select min(n.created_at) from public.notifications n where n.user_id = p.user_id and n.category = 'welcome'),
  now()
)
where p.welcomed_at is null
  and (
    exists (select 1 from public.notifications n where n.user_id = p.user_id and n.category = 'welcome')
    or exists (select 1 from auth.users u where u.id = p.user_id and u.last_sign_in_at is not null)
  );
