"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import {
  deleteUserAction,
  type AdminActionResult,
} from "@/lib/actions/user-admin";
import { Input, useToast } from "@/components/ui";

const initial: AdminActionResult = { ok: false, message: "" };

/**
 * Deleting an account cannot be undone, so the dialog asks for the username to
 * be typed rather than relying on a single click. The same check runs on the
 * server — this one only saves the round trip.
 */
export function DeleteUserButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState(
    deleteUserAction,
    initial,
  );
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      setOpen(false);
      setTyped("");
      router.refresh();
    }
  }, [state, toast, router]);

  const matches = typed.trim() === username;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${username}`}
        title={`Delete ${username}`}
        className="rounded-lg p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={15} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          {/* Width lives on this wrapper: a global .account-content .panel rule
              forces max-width:100% on every panel inside the admin area. */}
          <div className="w-full max-w-md">
            <div className="panel p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
                    <AlertTriangle size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <h2
                      id="delete-user-title"
                      className="font-display text-lg font-bold"
                    >
                      Delete {username}?
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      This removes the account and everything owned by it —
                      profile, gallery uploads, votes and notifications. It
                      cannot be undone.
                    </p>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="cart-link-muted shrink-0 rounded-lg p-1 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="mt-4 rounded-lg border border-line bg-ink/5 p-3 text-xs leading-relaxed text-muted">
                Accounts with order history cannot be deleted — those records
                are kept, and the deletion will be refused.
              </p>

              <form action={formAction} className="mt-4 space-y-3">
                <input type="hidden" name="userId" value={userId} />
                <label
                  htmlFor="confirm-username"
                  className="block text-xs font-semibold"
                >
                  Type <strong className="text-ink">{username}</strong> to
                  confirm
                </label>
                <Input
                  id="confirm-username"
                  name="confirmUsername"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  placeholder={username}
                  aria-describedby="delete-user-title"
                />

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
                    disabled={pending || !matches}
                    className="btn btn-sm border-danger/40 bg-danger/15 text-danger hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    {pending ? "Deleting…" : "Delete account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
