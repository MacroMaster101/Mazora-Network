"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/app-link";
import { LifeBuoy, Loader2, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { OtpInput } from "@/components/auth/auth-forms";
import { FormRow, Input, Modal } from "@/components/ui";
import {
  confirmAccountOwnerAction,
  ownerConfirmationStatusAction,
  sendOwnerEmailCodeAction,
} from "@/lib/actions/owner-confirmation";
import type { OwnerProof } from "@/lib/auth/owner-proof-kind";

/**
 * "Confirm it's you": the step before adding a passkey, linking Google or
 * Discord, setting a first password or turning two-step verification on. It
 * asks for exactly what the server checks (lib/auth/owner-confirmation): the
 * authenticator code, otherwise the current password, otherwise a code emailed
 * to the account. Passing it holds for 15 minutes.
 */
export function OwnerConfirmForm({
  proof,
  emailUnconfirmed = false,
  onConfirmed,
  onCancel,
}: {
  proof: OwnerProof;
  /** The account email is not confirmed, so no code can be sent to it. */
  emailUnconfirmed?: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "confirming">("idle");
  const [error, setError] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  // Google/Discord-only accounts: whether the emailed code is on its way.
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Also learned from the send attempt, for forms opened without the status.
  const [unconfirmed, setUnconfirmed] = useState(emailUnconfirmed);
  const busy = status !== "idle" || sending;

  const sendEmailCode = async () => {
    setError(null);
    setNotice(null);
    setSending(true);
    const result = await sendOwnerEmailCodeAction();
    setSending(false);
    if (!result.ok) {
      if (result.emailUnconfirmed) {
        setUnconfirmed(true);
        return;
      }
      setError(result.message ?? "The code couldn't be sent. Try again later.");
      return;
    }
    setEmailSent(true);
    setNotice(result.message ?? "Code sent.");
  };

  const confirm = async (form: HTMLFormElement) => {
    setError(null);
    setStatus("confirming");
    const result = await confirmAccountOwnerAction(new FormData(form));
    setStatus("idle");
    if (!result.ok) {
      setError(result.message ?? "That couldn't be checked right now. Please try again.");
      return;
    }
    onConfirmed();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm(event.currentTarget);
      }}
    >
      {proof === "code" && (
        <div className="grid gap-3">
          <p className="text-sm font-semibold text-ink">
            {useRecovery ? "Enter one of your recovery codes" : "Enter the code from your authenticator app"}
          </p>
          {useRecovery ? (
            <Input
              key="recovery"
              id="owner-confirm-recovery"
              name="recoveryCode"
              placeholder="XXXXX-XXXXX"
              aria-label="Recovery code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              required
              className="text-center font-mono tracking-widest"
              autoFocus
              disabled={busy}
            />
          ) : (
            // Sends the form on the sixth digit, like the sign-in code screen.
            <OtpInput key="app" id="owner-confirm-code" name="code" error={error ?? undefined} autoSubmit />
          )}
          {!useRecovery && (
            <p className="text-xs text-muted">The 6 digits from Google Authenticator or a similar app. Not your device PIN.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setUseRecovery((value) => !value);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 justify-self-start text-xs font-semibold text-accent-bright hover:underline"
          >
            {useRecovery ? <Smartphone size={14} aria-hidden="true" /> : <LifeBuoy size={14} aria-hidden="true" />}
            {useRecovery ? "Use your authenticator app instead" : "Lost your phone? Use a recovery code"}
          </button>
        </div>
      )}
      {proof === "password" && (
        <FormRow label="Your current password" htmlFor="owner-confirm-password">
          <Input id="owner-confirm-password" name="password" type="password" autoComplete="current-password" required autoFocus disabled={busy} />
        </FormRow>
      )}
      {proof === "email" && unconfirmed && (
        /* Nothing here can prove it's the owner: no password, no authenticator,
           and codes go only to a confirmed address. A password reset confirms it. */
        <div role="alert" className="grid gap-2 text-sm text-muted">
          <p>
            Your account email isn&apos;t confirmed yet, so we can&apos;t send it a code, and there&apos;s no password or
            authenticator to check instead.
          </p>
          <p>
            Use{" "}
            <Link href="/forgot-password" className="font-semibold text-accent-bright hover:underline">
              Forgot password
            </Link>{" "}
            to confirm your email and set a password, then try again. If you can&apos;t get into that inbox,{" "}
            <Link href="/support" className="font-semibold text-accent-bright hover:underline">
              contact Support
            </Link>
            .
          </p>
        </div>
      )}
      {proof === "email" && !unconfirmed && (
        <div className="grid gap-3">
          <p className="text-sm text-muted">
            Your account signs in with Google or Discord, so there&apos;s no password to check. We&apos;ll email a 6-digit
            code to your account email instead.
          </p>
          {emailSent ? (
            <>
              {notice && <p className="text-xs font-semibold text-success">{notice}</p>}
              <OtpInput key="email" id="owner-confirm-email-code" name="emailCode" error={error ?? undefined} autoSubmit />
              <button
                type="button"
                onClick={() => void sendEmailCode()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 justify-self-start text-xs font-semibold text-accent-bright hover:underline disabled:opacity-50"
              >
                <Mail size={14} aria-hidden="true" /> Send a new code
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void sendEmailCode()} disabled={busy} className="btn btn-ghost btn-sm justify-self-start">
              {sending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}
              {sending ? "Sending…" : "Email me a code"}
            </button>
          )}
        </div>
      )}
      {!(proof === "email" && unconfirmed) && <p className="text-xs text-muted">You won&apos;t be asked again for 15 minutes.</p>}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || (proof === "email" && !emailSent)}>
          {status === "confirming" && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {status === "confirming" ? "Checking…" : "Confirm"}
        </button>
      </div>
    </form>
  );
}

/**
 * The form plus the question of whether it is needed at all: a confirmation
 * from the last 15 minutes still holds, and then this goes straight on.
 */
export function OwnerConfirmPanel({
  description,
  onConfirmed,
  onCancel,
}: {
  description: string;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<
    { step: "loading" } | { step: "ask"; proof: OwnerProof; emailUnconfirmed: boolean } | { step: "error" }
  >({ step: "loading" });
  // The latest callback, without re-running the status check when it changes.
  const confirmed = useRef(onConfirmed);
  useEffect(() => {
    confirmed.current = onConfirmed;
  }, [onConfirmed]);

  useEffect(() => {
    let active = true;
    void ownerConfirmationStatusAction()
      .catch(() => null)
      .then((status) => {
        if (!active) return;
        if (!status) setState({ step: "error" });
        else if (!status.needed) confirmed.current();
        else setState({ step: "ask", proof: status.proof, emailUnconfirmed: Boolean(status.emailUnconfirmed) });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <ShieldCheck size={19} className="text-accent-bright" aria-hidden="true" /> Confirm it&apos;s you
        </h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {state.step === "loading" && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> One moment…
        </p>
      )}
      {state.step === "error" && (
        <>
          <p role="alert" className="text-sm font-semibold text-danger">
            That couldn&apos;t be checked right now. Refresh the page and try again.
          </p>
          <div className="flex justify-end">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Close
            </button>
          </div>
        </>
      )}
      {state.step === "ask" && (
        <OwnerConfirmForm
          proof={state.proof}
          emailUnconfirmed={state.emailUnconfirmed}
          onConfirmed={onConfirmed}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

/** OwnerConfirmPanel in its own popup, for buttons that are not already in one. */
export function OwnerConfirmDialog({
  description,
  onConfirmed,
  onClose,
}: {
  description: string;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} label="Confirm it's you" size="compact">
      <div className="panel p-6">
        <OwnerConfirmPanel description={description} onConfirmed={onConfirmed} onCancel={onClose} />
      </div>
    </Modal>
  );
}
