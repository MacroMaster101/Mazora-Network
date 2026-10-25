"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound, LifeBuoy, Loader2, Mail, Smartphone } from "lucide-react";
import { redeemRecoveryCodeAction, requestTwoFactorEmailCodeAction, verifyTwoFactorAction, verifyTwoFactorEmailCodeAction, type TwoFactorResult } from "@/lib/actions/two-factor";
import { Input } from "@/components/ui/field";
import { OtpInput } from "./auth-forms";

const initial: TwoFactorResult = { ok: false };

function FormMessage({ message }: { message?: string }) {
  return message ? (
    <p className="auth-form-message" role="alert">
      {message}
    </p>
  ) : null;
}

function AuthenticatorCodeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, initial);
  const codeError = state.errors?.code;

  return (
    <form action={action} className="auth-form mt-6 grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <OtpInput id="two-factor-code" name="code" error={codeError} autoSubmit />
      {codeError ? (
        <p id="two-factor-code-error" className="text-sm text-danger" role="alert">
          {codeError}
        </p>
      ) : null}
      <FormMessage message={state.message} />
      <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
        Verify and continue
      </button>
    </form>
  );
}

function RecoveryCodeForm() {
  const [state, action, pending] = useActionState(redeemRecoveryCodeAction, initial);
  const error = state.errors?.recoveryCode;

  return (
    <form action={action} className="auth-form mt-6 grid gap-4" noValidate>
      <div className="grid gap-2">
        {/* Short screens keep the input's own label (sr-only) and placeholder. */}
        <label htmlFor="two-factor-recovery" className="text-sm font-semibold text-ink [@media(max-height:880px)]:sr-only">
          Recovery code
        </label>
        <Input
          id="two-factor-recovery"
          name="recoveryCode"
          placeholder="XXXXX-XXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "two-factor-recovery-error" : "two-factor-recovery-hint"}
          className="text-center font-mono tracking-widest"
        />
        {error ? (
          <p id="two-factor-recovery-error" className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : (
          <p id="two-factor-recovery-hint" className="text-xs leading-relaxed text-muted [@media(max-height:760px)]:sr-only">
            Each recovery code works once. Two-step verification stays on — you can replace your authenticator in Settings.
          </p>
        )}
      </div>
      <FormMessage message={state.message} />
      <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <LifeBuoy size={17} />}
        Sign in with recovery code
      </button>
    </form>
  );
}

function EmailCodeForm({ next }: { next: string }) {
  const [sendState, sendAction, sending] = useActionState(requestTwoFactorEmailCodeAction, initial);
  const [state, action, pending] = useActionState(verifyTwoFactorEmailCodeAction, initial);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!sendState.ok) return;
    setSent(true);
    setCooldown(60);
  }, [sendState]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const codeError = state.errors?.code;

  return (
    <div className="mt-6 grid gap-4">
      <p className="text-sm leading-relaxed text-muted">Send a six-digit code to the confirmed account email shown above.</p>
      <form action={sendAction} className="grid gap-3">
        <button type="submit" disabled={sending || pending || cooldown > 0} className="btn btn-secondary disabled:opacity-60">
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />}
          {sending ? "Sending code…" : cooldown > 0 ? `Resend in ${cooldown}s` : sent ? "Resend email code" : "Email me a code"}
        </button>
        {sendState.ok ? <p className="text-sm text-muted" role="status">{sendState.message}</p> : <FormMessage message={sendState.message} />}
      </form>
      {sent ? (
        <form action={action} className="auth-form grid gap-4" noValidate>
          <input type="hidden" name="next" value={next} />
          <OtpInput id="two-factor-email-code" name="code" error={codeError} autoSubmit />
          {codeError ? <p id="two-factor-email-code-error" className="text-sm text-danger" role="alert">{codeError}</p> : null}
          <FormMessage message={state.message} />
          <button type="submit" disabled={pending || sending} className="btn btn-primary auth-submit disabled:opacity-70">
            {pending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
            Verify and continue
          </button>
        </form>
      ) : null}
    </div>
  );
}

type Method = "app" | "email" | "recovery";

/** How to switch to each method from one of the others. */
const SWITCH_TO: Record<Method, { label: string; icon: typeof Smartphone }> = {
  app: { label: "Use your authenticator app instead", icon: Smartphone },
  email: { label: "Email me a code instead", icon: Mail },
  recovery: { label: "Lost your phone? Use a recovery code", icon: LifeBuoy },
};

/**
 * The second step of signing in: an authenticator code, with the other ways in
 * as links underneath. Email is offered unless the owner turned it off in
 * Settings, or email delivery is not configured.
 */
export function TwoFactorSignIn({ next, emailAvailable = false }: { next: string; emailAvailable?: boolean }) {
  const [method, setMethod] = useState<Method>("app");
  const others = (["app", "email", "recovery"] as const).filter(
    (value) => value !== method && (value !== "email" || emailAvailable),
  );

  return (
    <>
      <div hidden={method !== "app"}><AuthenticatorCodeForm next={next} /></div>
      {emailAvailable ? <div hidden={method !== "email"}><EmailCodeForm next={next} /></div> : null}
      <div hidden={method !== "recovery"}><RecoveryCodeForm /></div>
      <div className="mt-5 flex flex-col items-center gap-2">
        {others.map((value) => {
          const { label, icon: Icon } = SWITCH_TO[value];
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMethod(value)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-bright hover:underline"
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
