-- Drop columns that no code path reads or writes.
--
-- Each was verified against the live database before removal:
--
--   audit_logs.ip_address        358 rows, 0 non-null. Never written anywhere
--                                in src/, although audit logging runs in 31
--                                files.
--   game_modes.server_address    6 rows, 0 non-null. Superseded by
--                                site_settings, read through
--                                getServerAddresses(); nothing reads this one.
--   orders.payment_status        Only ever held its own default, 'pending'.
--   orders.payment_provider      0 non-null.
--   orders.external_payment_id   0 non-null.
--
-- The three orders columns were reserved for a card provider that was never
-- integrated. Ordering is manual and staff-confirmed through Discord tickets,
-- and that flow tracks state in orders.status, so these three never carried
-- anything. Re-add them with the integration if one ever lands.
--
-- Deliberately KEPT: vote_history.vote_site_id. The table is empty and nothing
-- writes it yet, but it is the foreign key a Minecraft vote callback will need
-- once the plugin is connected.

begin;

alter table public.audit_logs drop column if exists ip_address;
alter table public.game_modes drop column if exists server_address;

alter table public.orders
  drop column if exists payment_status,
  drop column if exists payment_provider,
  drop column if exists external_payment_id;

commit;
