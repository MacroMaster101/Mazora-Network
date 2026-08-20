"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

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

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          onClick={() => setOpen(false)}
        >
          <div className="flex min-h-full items-center justify-center">
          <div
            className="my-auto w-full max-w-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel overflow-hidden p-0 shadow-2xl">
              <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:max-h-[calc(100dvh-3rem)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
                    <AlertTriangle size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="delete-user-title"
                      className="font-display text-xl font-extrabold text-ink"
                    >
                      Permanently delete {username}?
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      This permanently removes the account and its personal
                      data. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="cart-link-muted shrink-0 rounded-lg p-1 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                  <p className="font-bold text-ink">Permanently removed</p>
                  <p className="mt-1 leading-relaxed text-muted">
                    Login, profile, Minecraft links, votes, notifications,
                    support records, gallery submissions, and stored account media.
                  </p>
                </div>
                <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-4">
                  <p className="font-bold text-ink">Retained anonymously</p>
                  <p className="mt-1 leading-relaxed text-muted">
                    Order references, totals, status, and purchased items remain
                    for accounting. Personal identifiers and the account link are removed.
                  </p>
                </div>
              </div>

              <form action={formAction} className="mt-5 space-y-3">
                <input type="hidden" name="userId" value={userId} />
                <label
                  htmlFor="confirm-username"
                  className="block text-xs font-semibold"
                >
                  Type <strong className="text-ink">{username}</strong> to
                  permanently confirm
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
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
