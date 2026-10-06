"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, LifeBuoy, Loader2, ShieldCheck, Smartphone, UserRoundX } from "lucide-react";
import { deleteAccountAction, requestAccountDeletionCodeAction, type AccountActionResult } from "@/lib/actions/account";
import { FormRow, Input, Modal, useToast } from "@/components/ui";
import { OtpInput } from "@/components/auth/auth-forms";

const initialState: AccountActionResult = { ok: false };

/**
 * Account deletion only.
 *
 * A permanently-disabled "Minecraft linking · Coming soon" button used to sit
 * here, along with a disconnect dialog nothing could open. Setting and clearing
 * a Minecraft name now lives entirely in the Connected accounts card, which is
 * where users look for it.
 */
export function DangerZone({
  username,
  enabled,
  hasPassword = false,
  twoFactor = false,
}: {
  username: string;
  enabled: boolean;
  /** The account has a password, so deleting asks for it (deleteAccountAction). */
  hasPassword?: boolean;
  /** Two-step verification is on, so deleting also asks for a code. */
  twoFactor?: boolean;
}) {
  const [dialog, setDialog] = useState<"delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccountAction, initialState);
  const [sendState, sendAction, sendPending] = useActionState(requestAccountDeletionCodeAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (!deleteState.message) return;
    toast(deleteState.message, deleteState.ok ? "success" : "error");
    if (deleteState.ok) {
      setDialog(null);
      window.location.replace("/");
    }
  }, [deleteState, toast]);

  useEffect(() => {
    if (sendState.message) toast(sendState.message, sendState.ok ? "success" : "error");
  }, [sendState, toast]);

  const closeDialog = () => {
    if (deletePending || sendPending) return;
    setDialog(null);
    setConfirmation("");
    setUseRecovery(false);
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
            {hasPassword ? (
              <div className="mt-4">
                <FormRow label="Current password" htmlFor="delete-password" error={deleteState.errors?.currentPassword}>
                  <Input
                    id="delete-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    aria-invalid={Boolean(deleteState.errors?.currentPassword)}
                  />
                </FormRow>
              </div>
            ) : null}
            {!hasPassword && !twoFactor ? (
              <div className="mt-4 grid gap-3">
                <p className="text-sm text-muted">Confirm it is you with a code sent to your account email address. The code expires in 10 minutes.</p>
                <button type="submit" formAction={sendAction} formNoValidate className="btn btn-ghost btn-sm justify-self-start" disabled={deletePending || sendPending}>
                  {sendPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {sendPending ? "Sending…" : "Send confirmation code"}
                </button>
                <OtpInput id="delete-email-code" name="emailCode" error={deleteState.errors?.emailCode} />
                {deleteState.errors?.emailCode ? <p className="text-sm text-danger" role="alert">{deleteState.errors.emailCode}</p> : null}
              </div>
            ) : null}
            {twoFactor ? (
              /* The same step as signing in: the app's code, or a recovery code. */
              <div className="mt-4 grid gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ShieldCheck size={16} className="text-accent-bright" aria-hidden="true" />
                  {useRecovery ? "Recovery code" : "Code from your authenticator app"}
                </p>
                {useRecovery ? (
                  <Input
                    key="recovery"
                    name="recoveryCode"
                    placeholder="XXXXX-XXXXX"
                    aria-label="Recovery code"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={20}
                    aria-invalid={Boolean(deleteState.errors?.code)}
                    className="text-center font-mono tracking-widest"
                  />
                ) : (
                  <OtpInput key="app" id="delete-two-step-code" name="code" error={deleteState.errors?.code} />
                )}
                {deleteState.errors?.code ? (
                  <p className="text-sm text-danger" role="alert">
                    {deleteState.errors.code}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setUseRecovery((value) => !value)}
                  className="inline-flex items-center gap-1.5 justify-self-start text-xs font-semibold text-accent-bright hover:underline"
                >
                  {useRecovery ? <Smartphone size={14} aria-hidden="true" /> : <LifeBuoy size={14} aria-hidden="true" />}
                  {useRecovery ? "Use your authenticator app instead" : "Lost your phone? Use a recovery code"}
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={closeDialog} className="btn btn-ghost btn-sm" disabled={deletePending || sendPending}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-ghost btn-sm border-danger/40 bg-danger/10 text-danger"
              disabled={deletePending || sendPending || confirmation.toLowerCase() !== username.toLowerCase()}
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
