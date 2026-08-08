"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Loader2, UserRoundX } from "lucide-react";
import { deleteAccountAction, type AccountActionResult } from "@/lib/actions/account";
import { FormRow, Input, Modal, useToast } from "@/components/ui";

const initialState: AccountActionResult = { ok: false };

/**
 * Account deletion only.
 *
 * A permanently-disabled "Minecraft linking · Coming soon" button used to sit
 * here, along with a disconnect dialog nothing could open. Setting and clearing
 * a Minecraft name now lives entirely in the Connected accounts card, which is
 * where users look for it.
 */
export function DangerZone({ username, enabled }: { username: string; enabled: boolean }) {
  const [dialog, setDialog] = useState<"delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccountAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (!deleteState.message) return;
    toast(deleteState.message, deleteState.ok ? "success" : "error");
    if (deleteState.ok) {
      setDialog(null);
      window.location.replace("/");
    }
  }, [deleteState, toast]);

  const closeDialog = () => {
    if (deletePending) return;
    setDialog(null);
    setConfirmation("");
  };

  return (
    <>
      <section className="panel border-danger/30 p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-danger">
          <AlertTriangle size={18} /> Danger zone
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setDialog("delete")}
            className="btn btn-ghost btn-sm border-danger/40 text-danger"
            disabled={!enabled}
            title={!enabled ? "Requires full authentication" : undefined}
          >
            <UserRoundX size={14} /> Delete account
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          This action is permanent and requires a confirmation step.
        </p>
      </section>

      <Modal open={dialog === "delete"} onClose={closeDialog} label="Permanently delete account">
        <form action={deleteAction} className="panel mx-auto max-w-md border-danger/40 p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold text-danger">Permanently delete account?</h2>
          <p className="mt-2 text-sm text-muted">
            This removes your login, profile, linked accounts, submissions, orders, votes, and notifications. This cannot be undone.
          </p>
          <div className="mt-5">
            <FormRow
              label={`Type ${username} to confirm`}
              htmlFor="delete-confirmation"
              error={deleteState.errors?.confirmation}
            >
              <Input
                id="delete-confirmation"
                name="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
                aria-invalid={Boolean(deleteState.errors?.confirmation)}
              />
            </FormRow>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={closeDialog} className="btn btn-ghost btn-sm" disabled={deletePending}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-ghost btn-sm border-danger/40 bg-danger/10 text-danger"
              disabled={deletePending || confirmation.toLowerCase() !== username.toLowerCase()}
            >
              {deletePending ? <Loader2 size={14} className="animate-spin" /> : <UserRoundX size={14} />}
              {deletePending ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
