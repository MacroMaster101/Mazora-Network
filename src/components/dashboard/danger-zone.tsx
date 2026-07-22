"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Unlink, UserRoundX } from "lucide-react";
import {
  deleteAccountAction,
  disconnectMinecraftAction,
  type AccountActionResult,
} from "@/lib/actions/account";
import { FormRow, Input, Modal, useToast } from "@/components/ui";

const initialState: AccountActionResult = { ok: false };

export function DangerZone({
  username,
  initiallyLinked,
  enabled,
}: {
  username: string;
  initiallyLinked: boolean;
  enabled: boolean;
}) {
  const [linked, setLinked] = useState(initiallyLinked);
  const [dialog, setDialog] = useState<"disconnect" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    disconnectMinecraftAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccountAction, initialState);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!disconnectState.message) return;
    toast(disconnectState.message, disconnectState.ok ? "success" : "error");
    if (disconnectState.ok) {
      setLinked(false);
      setDialog(null);
      router.refresh();
    }
  }, [disconnectState, toast, router]);

  useEffect(() => {
    if (!deleteState.message) return;
    toast(deleteState.message, deleteState.ok ? "success" : "error");
    if (deleteState.ok) {
      setDialog(null);
      window.location.replace("/");
    }
  }, [deleteState, toast]);

  const closeDialog = () => {
    if (disconnectPending || deletePending) return;
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
            onClick={() => setDialog("disconnect")}
            className="btn btn-ghost btn-sm border-danger/40 text-danger"
            disabled={!enabled || !linked}
            title={!enabled ? "Requires full authentication" : !linked ? "No Minecraft account is connected" : undefined}
          >
            <Unlink size={14} /> {linked ? "Disconnect Minecraft" : "Minecraft not connected"}
          </button>
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
          These actions are permanent and require a confirmation step.
        </p>
      </section>

      <Modal open={dialog === "disconnect"} onClose={closeDialog} label="Disconnect Minecraft account">
        <div className="panel mx-auto max-w-md border-danger/30 p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold">Disconnect Minecraft?</h2>
          <p className="mt-2 text-sm text-muted">
            Your Minecraft identity and synced player statistics will be removed. You can link the account again later.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={closeDialog} className="btn btn-ghost btn-sm" disabled={disconnectPending}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => disconnectAction())}
              className="btn btn-ghost btn-sm border-danger/40 text-danger"
              disabled={disconnectPending}
            >
              {disconnectPending ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
              {disconnectPending ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      </Modal>

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