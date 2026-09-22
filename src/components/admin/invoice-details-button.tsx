"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import type { StoreInvoiceDetails } from "@/lib/types";
import { FormRow, Input, Modal, Textarea, useToast } from "@/components/ui";
import {
  saveInvoiceDetailsAction,
  type InvoiceActionResult,
} from "@/lib/actions/order-invoices";

/**
 * Edits the issuer block printed at the top of every invoice.
 *
 * These are business details only the operator can state correctly — the
 * trading name, the postal address a buyer might need for a receipt — and they
 * change without a deploy, so they are a setting rather than a constant.
 */

const EMPTY: InvoiceActionResult = { ok: false };

export function InvoiceDetailsButton({ details }: { details: StoreInvoiceDetails }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
        title="Business details printed on invoices"
      >
        <Building2 size={15} /> Invoice details
      </button>
      {open && <InvoiceDetailsDialog details={details} onClose={() => setOpen(false)} />}
    </>
  );
}

function InvoiceDetailsDialog({
  details,
  onClose,
}: {
  details: StoreInvoiceDetails;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState(saveInvoiceDetailsAction, EMPTY);

  const [businessName, setBusinessName] = useState(details.businessName);
  const [website, setWebsite] = useState(details.website);
  // One address line per row, which is how the sheet prints them.
  const [addressLines, setAddressLines] = useState(details.addressLines.join("\n"));
  const [postcode, setPostcode] = useState(details.postcode);
  const [footerNote, setFooterNote] = useState(details.footerNote);

  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  return (
    <Modal open onClose={onClose} label="Invoice details" size="compact">
      <div className="store-admin-modal panel overflow-hidden">
        <form action={action}>
          {/* Right padding reserves the modal's own close button. */}
          <header className="flex items-start gap-3 border-b border-line/60 py-5 pl-6 pr-[4.5rem]">
            <span className="mt-0.5 rounded-lg bg-accent/10 p-2 text-accent">
              <Building2 size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-extrabold text-ink">Invoice details</h2>
              <p className="mt-1 text-sm text-muted">
                Printed at the top of every invoice. Blank fields are simply left off.
              </p>
            </div>
          </header>

          <div className="space-y-4 p-6">
            <FormRow label="Business name" htmlFor="d-name" error={state.errors?.businessName}>
              <Input
                id="d-name"
                name="businessName"
                value={businessName}
                maxLength={80}
                onChange={(event) => setBusinessName(event.target.value)}
              />
            </FormRow>

            <FormRow label="Website" htmlFor="d-site" error={state.errors?.website}>
              <Input
                id="d-site"
                name="website"
                value={website}
                maxLength={120}
                placeholder="mazora.us"
                onChange={(event) => setWebsite(event.target.value)}
              />
            </FormRow>

            <FormRow label="Address (one line per row)" htmlFor="d-addr" error={state.errors?.addressLines}>
              <Textarea
                id="d-addr"
                name="addressLines"
                rows={3}
                value={addressLines}
                placeholder={"Street\nCity"}
                onChange={(event) => setAddressLines(event.target.value)}
              />
              <p className="mt-1 text-xs text-muted">Up to four lines.</p>
            </FormRow>

            <FormRow label="Postcode" htmlFor="d-post" error={state.errors?.postcode}>
              <Input
                id="d-post"
                name="postcode"
                value={postcode}
                maxLength={40}
                onChange={(event) => setPostcode(event.target.value)}
              />
            </FormRow>

            <FormRow label="Standing footer note" htmlFor="d-note" error={state.errors?.footerNote}>
              <Textarea
                id="d-note"
                name="footerNote"
                rows={2}
                value={footerNote}
                maxLength={400}
                placeholder="Shown under the items when an invoice has no note of its own."
                onChange={(event) => setFooterNote(event.target.value)}
              />
            </FormRow>

            {state.message && !state.ok && (
              <p className="text-sm font-semibold text-danger">{state.message}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={pending} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
                {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                {pending ? "Saving…" : "Save details"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
