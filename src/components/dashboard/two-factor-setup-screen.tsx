"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Lock, RotateCw, ShieldCheck } from "lucide-react";
import {
  confirmTwoFactorSetupAction,
  startTwoFactorEnrollmentAction,
  type TwoFactorEnrollment,
  type TwoFactorResult,
} from "@/lib/actions/two-factor";
import { Modal } from "@/components/ui";
import { OtpInput } from "@/components/auth/auth-forms";
import { RecoveryCodesView } from "./recovery-codes-view";

type Mode = "setup" | "replace";
type Step = "scan" | "codes";

const initial: TwoFactorResult = { ok: false };

/**
 * Authenticator setup popup: what and why on the left, the QR code and code
 * entry on the right (stacked on narrow screens), then — on a first setup —
 * the recovery codes. `replace` swaps the authenticator on an account that
 * already has one; the old one keeps working until the new one is confirmed.
 */
export function TwoFactorSetupScreen({
  mode,
  onClose,
  onFinished,
}: {
  mode: Mode;
  onClose: () => void;
  onFinished: (message: string) => void;
}) {
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null);
  const [step, setStep] = useState<Step>("scan");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [state, action, pending] = useActionState(confirmTwoFactorSetupAction, initial);
  const started = useRef(false);

  async function start() {
    setEnrollment(null);
    try {
      setEnrollment(await startTwoFactorEnrollmentAction());
    } catch {
      setEnrollment({ ok: false, message: "Two-step verification could not be set up. Please try again." });
    }
  }

  // Once per open. The ref survives React's development double-invoke, which
  // would otherwise enrol twice and leave the first QR code pointing at a
  // factor the second call already removed.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, []);

  useEffect(() => {
    if (!state.ok) return;
    if (state.recoveryCodes?.length) {
      setCodes(state.recoveryCodes);
      setStep("codes");
    } else {
      onFinished(state.message ?? "Two-step verification is on.");
    }
  }, [state, onFinished]);

  async function copyKey() {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setKeyCopied(true);
      window.setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      setKeyCopied(false);
    }
  }

  // Once the codes are showing, two-step verification is already on, so
  // closing the popup any way at all finishes — the card must refresh.
  const close = step === "codes" ? () => onFinished("Two-step verification is on.") : onClose;

  const replacing = mode === "replace";
  const steps = [
    { title: "Get an authenticator app", body: "Google Authenticator, Microsoft Authenticator, 1Password, Authy — any app that shows six-digit codes." },
    { title: "Scan the QR code", body: "Or type the setup key into the app by hand." },
    { title: "Enter the code it shows", body: "Codes change every 30 seconds; enter the current one." },
    ...(replacing ? [] : [{ title: "Save your recovery codes", body: "Your way back in if you ever lose your phone." }]),
  ];
  const activeStep = step === "codes" ? 3 : enrollment?.ok ? 1 : 0;
  const intro =
    step === "codes"
      ? "Two-step verification is on. If you ever lose your phone, one of these codes signs you in. Each works once, and this is the only time they are shown."
      : replacing
        ? "Link your new phone. Your current authenticator keeps working until the new one is confirmed."
        : "After your password, signing in will also ask for a code from an app on your phone — so a leaked password alone can never get into your account."
  const codeError = state.errors?.code;
  const keyGroups = enrollment?.secret?.match(/.{1,4}/g)?.join(" ") ?? "";

  return (
    <Modal open onClose={close} label="Two-step verification setup" size="wide">
      <div className="panel overflow-hidden">
        {/* Right padding reserves the modal's own close button. */}
        <header className="flex items-center gap-3 border-b border-line/60 py-3.5 pl-4 pr-[4.5rem] sm:pl-6 lg:py-5 lg:pl-9 [@media(max-height:700px)]:py-3">
          <span className="rounded-lg bg-accent/10 p-2 text-accent-bright lg:rounded-xl lg:p-2.5">
            <ShieldCheck size={18} aria-hidden="true" className="lg:h-6 lg:w-6" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-bright">Two-step verification</p>
            <h2 className="font-display text-lg font-extrabold leading-tight text-ink sm:text-xl lg:text-2xl">
              {step === "codes"
                ? "Save your recovery codes"
                : replacing
                  ? "Move to a new authenticator"
                  : "Protect your Mazora account"}
            </h2>
          </div>
        </header>

        {/* Phones: the short version on top — what this is and where you are —
            so the QR code still sits near the top of a small screen. */}
        <div className="border-b border-line/60 bg-ink/5 px-4 py-3 dark:bg-surface/40 sm:px-6 sm:py-4 md:hidden">
          {/* Short phones drop the sentence; the title and progress still say it. */}
          <p className="text-[13px] leading-relaxed text-muted sm:text-sm [@media(max-height:760px)]:hidden">{intro}</p>
          <div className="mt-3 flex gap-1.5 [@media(max-height:760px)]:mt-0" aria-hidden="true">
            {steps.map((item, index) => (
              <span
                key={item.title}
                className={`h-1.5 flex-1 rounded-full ${
                  index < activeStep ? "bg-success" : index === activeStep ? "bg-accent" : "bg-ink/10"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-ink">
            <span className="text-accent-bright">
              Step {activeStep + 1} of {steps.length}
            </span>{" "}
            · {steps[activeStep]?.title}
          </p>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Left (wider screens): what this is and where you are in it. */}
          <section className="hidden border-r border-line/60 bg-ink/5 p-7 dark:bg-surface/40 md:block lg:p-10 [@media(max-height:700px)]:p-6">
            <p className="text-sm leading-relaxed text-muted lg:text-base">{intro}</p>

            <ol className="mt-6 grid gap-4 lg:mt-8 lg:gap-6 [@media(max-height:700px)]:mt-4 [@media(max-height:700px)]:gap-3">
              {steps.map((item, index) => {
                const done = index < activeStep;
                const active = index === activeStep;
                return (
                  <li key={item.title} className="flex gap-3.5 lg:gap-4">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold lg:h-10 lg:w-10 lg:rounded-xl lg:text-sm ${
                        done
                          ? "border-success/40 bg-success/15 text-success"
                          : active
                            ? "border-accent bg-accent text-white shadow-lg shadow-accent/30"
                            : "border-line-strong text-muted"
                      }`}
                    >
                      {done ? <Check size={15} aria-hidden="true" /> : index + 1}
                    </span>
                    <div className={active || done ? "" : "opacity-60"}>
                      <p className="text-sm font-semibold text-ink lg:text-base">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted lg:text-sm [@media(max-height:700px)]:hidden">{item.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted lg:mt-8 lg:text-sm [@media(max-height:700px)]:mt-4">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              You can turn it off or move it to another phone any time from Settings.
            </p>
          </section>

          {/* Right: the thing to do. */}
          <section className="p-4 sm:p-6 md:p-7 lg:p-10 [@media(max-height:700px)]:py-5">
            {step === "codes" ? (
              <>
                <RecoveryCodesView codes={codes} />
                <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={saved}
                    onChange={(event) => setSaved(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
                  />
                  I have saved my recovery codes somewhere safe.
                </label>
                <button
                  type="button"
                  disabled={!saved}
                  onClick={() => onFinished("Two-step verification is on.")}
                  className="btn btn-primary auth-submit mt-5 w-full disabled:opacity-50"
                >
                  <ShieldCheck size={17} /> Finish
                </button>
              </>
            ) : !enrollment ? (
              <div className="grid min-h-[18rem] place-items-center text-muted">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Loader2 size={18} className="animate-spin" /> Preparing your QR code…
                </span>
              </div>
            ) : !enrollment.ok ? (
              <div className="grid min-h-[18rem] content-center gap-4 text-center">
                <p className="auth-form-message" role="alert">
                  {enrollment.message}
                </p>
                <button type="button" onClick={start} className="btn btn-ghost mx-auto">
                  <RotateCw size={16} /> Try again
                </button>
              </div>
            ) : (
              <>
                <div className="grid place-items-center">
                  {/*
                    Tablets and PCs size the QR code from the screen height: it
                    takes what the popup (90dvh) has left after everything else,
                    between 7rem and 14rem, so no desktop height needs a scroll.
                    A data: URL, so next/image has nothing to optimise.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={enrollment.qrCode}
                    alt="QR code to scan with your authenticator app"
                    width={224}
                    height={224}
                    className="h-36 w-36 rounded-2xl bg-white p-2.5 shadow-lg sm:h-44 sm:w-44 max-md:[@media(max-height:760px)]:h-32 max-md:[@media(max-height:760px)]:w-32 md:h-[clamp(7rem,calc(90dvh-33rem),14rem)] md:w-[clamp(7rem,calc(90dvh-33rem),14rem)] lg:p-3"
                  />
                </div>

                <div className="mt-4 rounded-xl border border-line-strong bg-ink/5 p-3 lg:mt-6 lg:p-4 [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Can&apos;t scan? Setup key</p>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <code className="select-all break-words font-mono text-xs tracking-wider text-ink sm:text-sm lg:text-base">{keyGroups}</code>
                    <button
                      type="button"
                      onClick={copyKey}
                      aria-label="Copy setup key"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-strong text-muted transition hover:border-accent hover:text-accent-bright"
                    >
                      {keyCopied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>

                <form action={action} className="auth-form mt-4 grid gap-3 sm:mt-5 sm:gap-3.5 lg:mt-6 lg:gap-4 [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:gap-2.5" noValidate>
                  <input type="hidden" name="factorId" value={enrollment.factorId} />
                  <p className="text-sm font-semibold text-ink lg:text-base">Enter the six-digit code from the app</p>
                  <OtpInput id="two-factor-setup-code" name="code" error={codeError} />
                  {codeError ? (
                    <p id="two-factor-setup-code-error" className="text-sm text-danger" role="alert">
                      {codeError}
                    </p>
                  ) : null}
                  {state.message && !state.ok ? (
                    <p className="auth-form-message" role="alert">
                      {state.message}
                    </p>
                  ) : null}
                  <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
                    {pending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
                    {replacing ? "Verify and switch" : "Verify and turn on"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
