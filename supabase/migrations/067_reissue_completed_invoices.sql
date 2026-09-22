-- Re-run the completed-order invoice backfill.
--
-- 065 did this once, but invoices issued then were removed while the invoice
-- feature was still being built, and a migration that has already been applied
-- does not run again. Without this, orders that are completed and delivered
-- would show no invoice to download.
--
-- Same rules as 065: numbered from the order reference, issued_at and issued_by
-- taken from whoever actioned the sale, orders without a reference skipped, and
-- idempotent so it is safe whether or not 065 left rows behind.

begin;

insert into public.order_invoices (order_id, invoice_no, issued_at, issued_by)
select o.id,
       o.reference,
       coalesce(o.handled_at, o.created_at),
       o.handled_by
from public.orders o
where o.status = 'completed'
  and o.reference is not null
  and not exists (
    select 1 from public.order_invoices i where i.order_id = o.id
  )
on conflict (order_id) do nothing;

commit;
