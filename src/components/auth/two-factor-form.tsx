"use client";

import { useActionState, useState } from "react";
import { KeyRound, LifeBuoy, Loader2, Smartphone } from "lucide-react";
import { redeemRecoveryCodeAction, verifyTwoFactorAction, type TwoFactorResult } from "@/lib/actions/two-factor";
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
      <OtpInput id="two-factor-code" name="code" error={codeError} />
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

/** The second step of signing in: an authenticator code, or a recovery code instead. */
export function TwoFactorSignIn({ next }: { next: string }) {
  const [useRecovery, setUseRecovery] = useState(false);

  return (
    <>
      {useRecovery ? <RecoveryCodeForm /> : <AuthenticatorCodeForm next={next} />}
      <button
        type="button"
        onClick={() => setUseRecovery((value) => !value)}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-bright hover:underline"
      >
        {useRecovery ? <Smartphone size={15} aria-hidden="true" /> : <LifeBuoy size={15} aria-hidden="true" />}
        {useRecovery ? "Use your authenticator app instead" : "Lost your phone? Use a recovery code"}
      </button>
    </>
  );
}
