-- Issue invoices for orders that were completed before invoices existed.
--
-- Completion now auto-issues an invoice (see markOrderDecision), but orders
-- completed before that shipped have none, so the Orders admin would show
-- "Create invoice" on sales that are already delivered and paid.
--
-- The invoice number is the order reference, matching what the auto-issue path
-- and the admin form both default to. `issued_by` is taken from whoever
-- actioned the order, so the document names the staff member who handled the
-- sale rather than whoever happened to run this migration.
--
-- Idempotent: `on conflict do nothing` on order_id, and the select already
-- excludes orders that have an invoice, so re-running changes nothing.
--
-- Orders with no reference are skipped rather than given a generated number —
-- invoice_no is unique, and inventing one for a row that predates references
-- would put a number on a document nobody can match to anything.

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
