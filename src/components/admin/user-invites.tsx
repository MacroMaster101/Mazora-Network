"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { Loader2, Mail, RotateCw, Send, UserPlus, X } from "lucide-react";
import type { Role } from "@/lib/types";
import { roleLabel } from "@/lib/auth/roles";
import {
  inviteUserAction,
  resendInviteAction,
  revokeInviteAction,
  type AdminActionResult,
} from "@/lib/actions/user-admin";
import { RankChip } from "@/components/admin/rank-chip";
import { FormRow, Input, Modal, Select, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

const initial: AdminActionResult = { ok: false, message: "" };

export interface PendingInvite {
  userId: string;
  email: string;
  role: Role;
  invitedAt: string | null;
}

/** Header action: opens the invite form. */
export function InviteUserButton({
  assignable,
  label = "Invite staff",
}: {
  assignable: Role[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    inviteUserAction,
    initial,
  );
  const { toast } = useToast();

  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) setOpen(false);
  }, [state, toast]);

  if (assignable.length === 0) {
    return (
      <span className="text-xs text-muted">
        Your rank cannot invite people.
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary btn-sm"
      >
        <UserPlus size={15} /> {label}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} label="Invite a staff member" size="compact">
            <div className="panel p-6">
              <div className="pr-12">
                <div>
                  <h2
                    id="invite-staff-title"
                    className="font-display text-lg font-bold"
                  >
                    Invite a staff member
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    We email them a link to set a password. Their rank is
                    applied when the account is created, so they arrive already
                    on the team.
                  </p>
                </div>
              </div>

              <form action={formAction} className="mt-5 space-y-4">
                <FormRow label="Email address" htmlFor="invite-email">
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder="them@example.com"
                  />
                </FormRow>

                <FormRow label="Starting rank" htmlFor="invite-role">
                  <Select
                    id="invite-role"
                    name="role"
                    defaultValue={assignable[0]}
                    required
                  >
                    {assignable.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </Select>
                </FormRow>

                <p className="text-[11px] leading-relaxed text-muted">
                  You can only invite below your own rank. Change it later on
                  the Users board.
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="btn btn-primary btn-sm disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    {pending ? "Sending…" : "Send invitation"}
                  </button>
                </div>
              </form>
            </div>
      </Modal>
    </>
  );
}

/** Outstanding invitations, with resend and withdraw. */
export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const [revokeState, revokeAction, revoking] = useActionState(
    revokeInviteAction,
    initial,
  );
  const [resendState, resendAction, resending] = useActionState(
    resendInviteAction,
    initial,
  );
  const { toast } = useToast();

  useEffect(() => {
    if (revokeState.message)
      toast(revokeState.message, revokeState.ok ? "success" : "error");
  }, [revokeState, toast]);
  useEffect(() => {
    if (resendState.message)
      toast(resendState.message, resendState.ok ? "success" : "error");
  }, [resendState, toast]);

  if (invites.length === 0) return null;

  const submit = (action: (fd: FormData) => void, userId: string) => {
    const data = new FormData();
    data.append("userId", userId);
    startTransition(() => action(data));
  };

  return (
    <section aria-labelledby="pending-invites" className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <h2
          id="pending-invites"
          className="font-display text-sm font-bold uppercase tracking-widest"
        >
          Pending invitations
        </h2>
        <span className="telemetry text-xs text-muted">{invites.length}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {invites.map((invite) => (
          <article key={invite.userId} className="panel border-warning/25 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
                <Mail size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-semibold">
                  {invite.email}
                </strong>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <RankChip role={invite.role} />
                  {invite.invitedAt && (
                    <span className="text-[11px] text-muted">
                      Sent {fmtDate(invite.invitedAt)}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => submit(resendAction, invite.userId)}
                disabled={resending}
                className="btn btn-ghost btn-sm disabled:opacity-60"
              >
                {resending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RotateCw size={13} />
                )}
                Resend
              </button>
              <button
                type="button"
                onClick={() => submit(revokeAction, invite.userId)}
                disabled={revoking}
                className="btn btn-ghost btn-sm text-danger disabled:opacity-60"
              >
                {revoking ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <X size={13} />
                )}
                Withdraw
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
