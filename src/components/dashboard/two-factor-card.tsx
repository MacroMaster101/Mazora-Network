"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { Input, Modal, useToast } from "@/components/ui";
import { OtpInput } from "@/components/auth/auth-forms";
import { disableTwoFactorAction, regenerateRecoveryCodesAction } from "@/lib/actions/two-factor";
import { relative } from "@/lib/utils";
import { RecoveryCodesView } from "./recovery-codes-view";
import { TwoFactorSetupScreen } from "./two-factor-setup-screen";

export interface TwoFactorOverview {
  enabled: boolean;
  /** When the current authenticator was added, ISO. */
  enrolledAt: string | null;
  codesRemaining: number;
  /** This sign-in used a recovery code instead of the authenticator app. */
  recovered: boolean;
}

function Row({
  icon,
  title,
  detail,
  action,
  muted,
}: {
  icon: ReactNode;
  title: string;
  detail: ReactNode;
  action?: ReactNode;
  muted?: boolean;
}) {
  return (
    // Muted rows dim only their icon: the "Coming soon" pill already says the
    // option is unavailable, and fading the whole row took its small text below 4.5:1.
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 ${muted ? "[&>span:first-child]:opacity-60" : ""}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{detail}</p>
      </div>
      {action}
    </div>
  );
}

const actionButton =
  "inline-flex items-center gap-2 rounded-lg border border-line-strong px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-accent/50 hover:text-accent-bright disabled:opacity-50";

const KEEP_CURRENT_KEY = "mz-2fa-recovery-reminder-hidden";

function ComingSoon() {
  return (
    <span className="rounded-full border border-line-strong bg-ink/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
      Coming soon
    </span>
  );
}

/**
 * Settings → Two-step verification. Optional, for every account: an
 * authenticator app today, with passkeys and text messages to follow.
 */
export function TwoFactorCard({
  overview,
  staff = false,
  passkeysLive = false,
}: {
  overview: TwoFactorOverview;
  staff?: boolean;
  /** Passkeys have their own card once switched on (a verified passkey sign-in covers this step too). */
  passkeysLive?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [setup, setSetup] = useState<"setup" | "replace" | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dialog, setDialog] = useState<"regenerate" | "disable" | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [keptCurrent, setKeptCurrent] = useState(false);

  /*
    "Keep current" hides the recovery-code reminder for the rest of this browser
    session: the member still has their phone and only used a code once. Purely
    a display choice — nothing about the account changes. Browser storage can
    be unavailable (private windows), in which case the reminder just shows.
  */
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEEP_CURRENT_KEY) === "1") setKeptCurrent(true);
    } catch {
      /* storage unavailable: keep showing the reminder */
    }
  }, []);
  function keepCurrent() {
    setKeptCurrent(true);
    try {
      window.sessionStorage.setItem(KEEP_CURRENT_KEY, "1");
    } catch {
      /* storage unavailable: hidden until the page reloads */
    }
  }
  const [dialogError, setDialogError] = useState<string | null>(null);
  // The dialog asks for the authenticator code; a recovery code is the fallback.
  const [useRecovery, setUseRecovery] = useState(false);

  const closeSetup = useCallback(() => setSetup(null), []);
  const finishedSetup = useCallback(
    (message: string) => {
      setSetup(null);
      toast(message, "success");
      router.refresh();
    },
    [router, toast],
  );

  function closeDialog() {
    setDialog(null);
    setNewCodes(null);
    setDialogError(null);
    setUseRecovery(false);
  }

  async function run(kind: "regenerate" | "disable", formData: FormData) {
    setBusy(true);
    setDialogError(null);
    try {
      // Both need the second step again, not just this signed-in browser.
      const result = kind === "regenerate" ? await regenerateRecoveryCodesAction(formData) : await disableTwoFactorAction(formData);
      if (!result.ok) {
        setDialogError(result.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.refresh();
      if (kind === "regenerate" && result.recoveryCodes) {
        setNewCodes(result.recoveryCodes);
      } else {
        closeDialog();
        setMoreOpen(false);
        toast(result.message ?? "Done.", "success");
      }
    } catch {
      setDialogError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const { enabled, enrolledAt, codesRemaining, recovered } = overview;

  return (
    <section
      id="two-step"
      className="panel scroll-mt-24 overflow-hidden border-line-strong bg-card/95 p-0 shadow-lg backdrop-blur-xl dark:bg-card/80"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-strong bg-ink/5 px-6 py-4 dark:bg-surface/50">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">Two-step verification</h2>
        {enabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
            <ShieldCheck size={12} aria-hidden="true" /> Active
          </span>
        ) : staff ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <TriangleAlert size={12} aria-hidden="true" /> Recommended for staff
          </span>
        ) : (
          <span className="rounded-full border border-line-strong bg-ink/5 px-2.5 py-1 text-[11px] font-bold text-muted">Off</span>
        )}
      </div>

      <div className="space-y-4 p-6">
        <p className="-mt-1 text-sm text-muted">
          Optional. Protects your account by asking for a second step after your password when you sign in.
        </p>

        {staff && !enabled ? (
          <p className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-600 dark:text-amber-500">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Your staff account can change the site. With two-step verification on, a leaked or guessed password
            alone can&apos;t get into it — it takes about a minute to set up.
          </p>
        ) : null}

        {recovered && enabled && !keptCurrent ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-600 dark:text-amber-500">
            <TriangleAlert size={14} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              You signed in with a recovery code — {codesRemaining} of 10 left. Lost your phone? Replace your authenticator
              app{codesRemaining <= 3 ? " and regenerate your codes" : ""}.
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={keepCurrent} className={actionButton} title="I still have my phone">
                Keep current
              </button>
              <button type="button" onClick={() => setSetup("replace")} className={actionButton}>
                Replace authenticator
              </button>
            </div>
          </div>
        ) : null}

        <div className="divide-y divide-line-strong/60 overflow-hidden rounded-2xl border border-line-strong">
          <Row
            icon={<Smartphone size={18} aria-hidden="true" />}
            title="Authenticator app"
            detail={enabled ? `Set up${enrolledAt ? ` ${relative(enrolledAt)}` : ""}` : "Use a code from an app like Google Authenticator."}
            action={
              <button type="button" onClick={() => setSetup(enabled ? "replace" : "setup")} className={actionButton}>
                {enabled ? "Replace" : "Set up"}
              </button>
            }
          />
          {/* Once live, passkeys are managed in their own card below (they
              replace the password, not this step); this row points there. */}
          <Row
            icon={<Fingerprint size={18} aria-hidden="true" />}
            title="Passkeys"
            detail={
              passkeysLive
                ? "Sign in with your fingerprint, face or device PIN instead of your password."
                : "Sign in with your fingerprint, face or device PIN."
            }
            action={
              passkeysLive ? (
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => document.getElementById("passkeys")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  Manage
                </button>
              ) : (
                <ComingSoon />
              )
            }
            muted={!passkeysLive}
          />
          <Row
            icon={<MessageSquareText size={18} aria-hidden="true" />}
            title="Text message"
            detail="Get a code by SMS to your phone number."
            action={<ComingSoon />}
            muted
          />

          {enabled ? (
            <>
              {/* A full row, not a footnote: recovery codes are how members get back in. */}
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-expanded={moreOpen}
                className={`group flex w-full items-center gap-x-4 px-4 py-4 text-left transition hover:bg-accent/5 sm:px-5 ${moreOpen ? "bg-accent/5" : ""}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent-bright">
                  <KeyRound size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">Recovery codes &amp; security options</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {codesRemaining} of 10 recovery codes left · regenerate codes or turn off two-step verification
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition group-hover:border-accent/50 group-hover:text-accent-bright">
                  {moreOpen ? "Hide" : "Manage"}
                  <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </span>
              </button>
              {moreOpen ? (
                <>
                  <Row
                    icon={<ShieldCheck size={18} aria-hidden="true" />}
                    title="Recovery codes"
                    detail={`Single-use codes for when you lose your phone. ${codesRemaining} of 10 left.`}
                    action={
                      <button type="button" onClick={() => setDialog("regenerate")} className={actionButton}>
                        Regenerate
                      </button>
                    }
                  />
                  <Row
                    icon={<ShieldOff size={18} aria-hidden="true" />}
                    title="Turn off two-step verification"
                    detail="Signing in will only need your password. Your app's code and recovery codes stop working."
                    action={
                      <button type="button" onClick={() => setDialog("disable")} className={`${actionButton} hover:border-danger/50 hover:text-danger`}>
                        Turn off
                      </button>
                    }
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {setup ? <TwoFactorSetupScreen mode={setup} onClose={closeSetup} onFinished={finishedSetup} /> : null}

      {/* Same shape as the other confirm dialogs (Settings → Delete account). */}
      <Modal
        open={dialog !== null}
        onClose={closeDialog}
        label={dialog === "disable" ? "Turn off two-step verification" : "Regenerate recovery codes"}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (newCodes) closeDialog();
            else if (dialog && !busy) run(dialog, new FormData(event.currentTarget));
          }}
          noValidate
          className={`panel mx-auto max-w-md p-6 sm:p-7 ${dialog === "disable" ? "border-danger/40" : ""}`}
        >
          <h2 className={`font-display text-xl font-bold ${dialog === "disable" ? "text-danger" : "text-ink"}`}>
            {dialog === "disable" ? "Turn off two-step verification?" : newCodes ? "Your new recovery codes" : "Regenerate recovery codes?"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {dialog === "disable"
              ? "Signing in will only need your password again. The Mazora code in your authenticator app and your recovery codes stop working for good — turning it back on later means scanning a new QR code."
              : newCodes
                ? "Save these now — this is the only time they are shown. Your old codes no longer work."
                : "You will get 10 new codes, and every code you have now will stop working."}
          </p>
          <div className="mt-5">
            {newCodes ? (
              <RecoveryCodesView codes={newCodes} />
            ) : (
              /* The same step as signing in (/two-factor): the app's code in
                 the six boxes, or a recovery code for a lost phone. */
              <div className="grid gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ShieldCheck size={16} className="text-accent-bright" aria-hidden="true" />
                  {useRecovery ? "Enter a recovery code to confirm" : "Enter the code from your authenticator app"}
                </p>
                {useRecovery ? (
                  <Input
                    key="recovery"
                    id="two-step-confirm-recovery"
                    name="recoveryCode"
                    placeholder="XXXXX-XXXXX"
                    aria-label="Recovery code"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={20}
                    aria-invalid={Boolean(dialogError)}
                    className="text-center font-mono tracking-widest"
                    autoFocus
                  />
                ) : (
                  <OtpInput key="app" id="two-step-confirm-code" name="code" error={dialogError ?? undefined} />
                )}
                {dialogError ? (
                  <p className="text-sm text-danger" role="alert">
                    {dialogError}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery((value) => !value);
                    setDialogError(null);
                  }}
                  className="inline-flex items-center gap-1.5 justify-self-start text-xs font-semibold text-accent-bright hover:underline"
                >
                  {useRecovery ? <Smartphone size={14} aria-hidden="true" /> : <LifeBuoy size={14} aria-hidden="true" />}
                  {useRecovery ? "Use your authenticator app instead" : "Lost your phone? Use a recovery code"}
                </button>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {newCodes ? (
              <button type="submit" className="btn btn-primary btn-sm">
                I have saved them
              </button>
            ) : (
              <>
                <button type="button" onClick={closeDialog} disabled={busy} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className={`btn btn-sm ${dialog === "disable" ? "btn-ghost border-danger/40 bg-danger/10 text-danger" : "btn-primary"}`}
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : dialog === "disable" ? (
                    <ShieldOff size={14} aria-hidden="true" />
                  ) : (
                    <KeyRound size={14} aria-hidden="true" />
                  )}
                  {dialog === "disable" ? (busy ? "Turning off…" : "Turn off") : busy ? "Creating…" : "Regenerate codes"}
                </button>
              </>
            )}
          </div>
        </form>
      </Modal>
    </section>
  );
}
