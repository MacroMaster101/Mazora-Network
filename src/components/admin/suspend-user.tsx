"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, UserCheck } from "lucide-react";
import { setUserSuspendedAction, type AdminActionResult } from "@/lib/actions/user-admin";
import { FormRow, Modal, Textarea, useToast } from "@/components/ui";

const initial: AdminActionResult = { ok: false, message: "" };

/**
 * Suspend or restore an account from the Users board. Suspending signs the
 * member out everywhere and blocks sign-in; nothing is deleted, so restoring
 * puts everything back. The server re-checks rank and permission.
 */
export function SuspendUserButton({
  userId,
  username,
  suspended,
}: {
  userId: string;
  username: string;
  suspended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setUserSuspendedAction, initial);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, toast, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={suspended ? `Unsuspend ${username}` : `Suspend ${username}`}
        className={
          suspended
            ? "inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs font-semibold text-success transition hover:bg-success/20"
            : "inline-flex items-center gap-1 rounded-md border border-line bg-ink/5 px-2 py-1 text-xs font-semibold text-muted transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
        }
      >
        {suspended ? <UserCheck size={12} aria-hidden="true" /> : <Ban size={12} aria-hidden="true" />}
        {/* Icon only in the table between xl and 2xl, where the column is tight; the title and label still say it. */}
        <span className="xl:max-2xl:sr-only">{suspended ? "Unsuspend" : "Suspend"}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} label={suspended ? `Unsuspend ${username}` : `Suspend ${username}`}>
        <form action={formAction} className={`panel mx-auto max-w-md p-6 sm:p-7 ${suspended ? "" : "border-danger/40"}`}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="suspend" value={suspended ? "false" : "true"} />
          <h2 className={`font-display text-xl font-bold ${suspended ? "text-ink" : "text-danger"}`}>
            {suspended ? `Unsuspend ${username}?` : `Suspend ${username}?`}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {suspended
              ? "They can sign in again straight away, with the same rank, orders, posts and settings they had before."
              : "They are signed out everywhere and cannot sign in until you unsuspend them. Nothing is deleted — their rank, orders, posts and settings stay as they are."}
          </p>

          <div className="mt-5">
            <FormRow label="Reason" htmlFor={`suspend-reason-${userId}`} hint="Optional · kept in the audit log">
              <Textarea
                id={`suspend-reason-${userId}`}
                name="reason"
                rows={3}
                maxLength={300}
                placeholder={suspended ? "Appeal accepted" : "Chargeback on order, ban evasion, …"}
              />
            </FormRow>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`btn btn-sm ${suspended ? "btn-primary" : "btn-ghost border-danger/40 bg-danger/10 text-danger"}`}
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : suspended ? (
                <UserCheck size={14} aria-hidden="true" />
              ) : (
                <Ban size={14} aria-hidden="true" />
              )}
              {suspended ? (pending ? "Restoring…" : "Unsuspend") : pending ? "Suspending…" : "Suspend account"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
