"use client";

import { useActionState, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { ZodTypeAny } from "zod";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Send,
  UserRound,
} from "lucide-react";
import {
  loginAction,
  oauthAction,
  registerAction,
  requestPasswordResetAction,
  updatePasswordAction,
  type AuthResult,
} from "@/lib/actions/auth";
import { FormRow, Input } from "@/components/ui";
import {
  authValidationErrors,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetRequestSchema,
} from "@/lib/validation/auth";
import { DiscordIcon, GoogleIcon } from "./provider-icons";
import { AuthFlowLink } from "./auth-dialog-provider";

const initial: AuthResult = { ok: false };

function useClientValidation(schema: ZodTypeAny, serverState: AuthResult) {
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [editedFields, setEditedFields] = useState<Set<string>>(() => new Set());

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const result = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (result.success) {
      setClientErrors({});
      setEditedFields(new Set());
      return;
    }

    event.preventDefault();
    const errors = authValidationErrors(result.error);
    setClientErrors(errors);
    const firstInvalidName = Object.keys(errors)[0];
    requestAnimationFrame(() => {
      const control = firstInvalidName ? form.elements.namedItem(firstInvalidName) : null;
      if (control instanceof HTMLElement) control.focus();
    });
  }

  function onInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.name) return;
    const name = target.name;
    setEditedFields((current) => new Set(current).add(name));
    setClientErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  return {
    onSubmit,
    onInput,
    errorFor(name: string) {
      return clientErrors[name] ?? (editedFields.has(name) ? undefined : serverState.errors?.[name]);
    },
    message: editedFields.size ? undefined : serverState.message,
  };
}

function FieldShell({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-field-shell">
      <span className="auth-field-icon" aria-hidden="true">{icon}</span>
      {children}
    </div>
  );
}

function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  error,
  strength = false,
  onValueChange,
}: {
  id: string;
  name: string;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  strength?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const describedBy = [error ? `${id}-error` : null, strength ? `${id}-strength` : null].filter(Boolean).join(" ") || undefined;
  return (
    <>
      <FieldShell icon={<LockKeyhole size={17} />}>
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onValueChange?.(event.target.value);
          }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          minLength={autoComplete === "new-password" ? 8 : undefined}
          maxLength={128}
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="auth-field auth-password-field"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="auth-password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </FieldShell>
      {strength && <PasswordStrength id={`${id}-strength`} value={value} />}
    </>
  );
}

function PasswordStrength({ id, value }: { id: string; value: string }) {
  const score = value
    ? [value.length >= 8, value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /[^a-zA-Z]/.test(value)].filter(Boolean).length
    : 0;
  const labels = ["Add more characters", "Weak", "Fair", "Good", "Strong"];
  return (
    <div id={id} className="auth-password-strength" data-score={score} aria-live="polite">
      <span className="sr-only">Password strength: {labels[score]}</span>
      <div aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => <i key={segment} className={segment <= score ? "is-filled" : undefined} />)}
      </div>
      <p>{value ? labels[score] : "Use 8–128 characters; 12+ is stronger."}</p>
    </div>
  );
}

function PasswordRules({ value }: { value: string }) {
  const rules = [
    ["8+ characters", value.length >= 8],
    ["Uppercase", /[A-Z]/.test(value)],
    ["Lowercase", /[a-z]/.test(value)],
    ["Number", /[0-9]/.test(value)],
    ["Symbol", /[^a-zA-Z0-9]/.test(value)],
  ] as const;

  return (
    <div className="auth-password-rules" aria-label="Password requirements" aria-live="polite">
      {rules.map(([label, met]) => (
        <span key={label} className={met ? "is-met" : undefined}>
          <i aria-hidden="true">{met && <Check size={10} strokeWidth={3} />}</i>
          {label}
        </span>
      ))}
    </div>
  );
}

function AuthMessage({ message }: { message?: string }) {
  return message ? <p className="auth-form-message" role="alert">{message}</p> : null;
}

function SocialButtons({ next = "/dashboard", mode = "login" }: { next?: string; mode?: "login" | "register" }) {
  const [googleState, googleAction, googlePending] = useActionState(oauthAction, initial);
  const [discordState, discordAction, discordPending] = useActionState(oauthAction, initial);
  const message = googleState.message ?? discordState.message;
  return (
    <>
      <div className="auth-providers">
        <form action={googleAction}>
          <input type="hidden" name="provider" value="google" />
          <input type="hidden" name="next" value={next} />
          <button type="submit" disabled={googlePending || discordPending} className="auth-provider-button" aria-label={`${mode === "register" ? "Sign up" : "Continue"} with Google`}>
            {googlePending ? <Loader2 size={17} className="animate-spin" /> : <GoogleIcon className="h-[18px] w-[18px]" />}
            <span>Google</span>
          </button>
        </form>
        <form action={discordAction}>
          <input type="hidden" name="provider" value="discord" />
          <input type="hidden" name="next" value={next} />
          <button type="submit" disabled={googlePending || discordPending} className="auth-provider-button" aria-label={`${mode === "register" ? "Sign up" : "Continue"} with Discord`}>
            {discordPending ? <Loader2 size={17} className="animate-spin" /> : <DiscordIcon className="h-[18px] w-[18px]" />}
            <span>Discord</span>
          </button>
        </form>
      </div>
      <AuthMessage message={message} />
    </>
  );
}

function AuthDivider() {
  return (
    <div className="auth-divider">
      <span /> <p>or use email</p> <span />
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const validation = useClientValidation(loginSchema, state);
  const emailError = validation.errorFor("identifier");
  const passwordError = validation.errorFor("password");
  return (
    <div className="auth-form-stack">
      <SocialButtons next={next} />
      <AuthDivider />
      <form action={action} className="auth-form" noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
        {next && <input type="hidden" name="next" value={next} />}
        <FormRow label="Email address" htmlFor="identifier" error={emailError}>
          <FieldShell icon={<UserRound size={17} />}>
            <Input id="identifier" name="identifier" type="email" required maxLength={254} placeholder="you@example.com" autoComplete="email" inputMode="email" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "identifier-error" : undefined} className="auth-field" />
          </FieldShell>
        </FormRow>
        <FormRow label="Password" htmlFor="password" error={passwordError}>
          <PasswordInput id="password" name="password" placeholder="Enter your password" autoComplete="current-password" error={passwordError} />
        </FormRow>
        <AuthMessage message={validation.message} />
        <div className="auth-form-options">
          <label className="auth-checkbox">
            <input type="checkbox" name="remember" />
            <span className="auth-remember-switch" aria-hidden="true"><i /></span>
            <span className="auth-remember-copy">
              <strong>Remember me</strong>
              <small>Stay signed in on this device</small>
            </span>
          </label>
          <AuthFlowLink view="forgot-password" href="/forgot-password">Forgot password?</AuthFlowLink>
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary auth-submit auth-account-submit disabled:opacity-70">
          <span className="auth-account-submit-icon">
            {pending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
          </span>
          <span className="auth-account-submit-copy">
            <strong>{pending ? "Signing in…" : "Log in"}</strong>
            <small>Continue your Mazora journey</small>
          </span>
          <span className="auth-account-submit-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
        </button>
      </form>
      <p className="auth-switch-copy">
        <span>New to Mazora?</span>
        <AuthFlowLink view="register" href="/register">Create an account</AuthFlowLink>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  const [passwordValue, setPasswordValue] = useState("");
  const validation = useClientValidation(registerSchema, state);
  const usernameError = validation.errorFor("username");
  const emailError = validation.errorFor("email");
  const passwordError = validation.errorFor("password");
  const confirmError = validation.errorFor("confirm");
  const termsError = validation.errorFor("terms");
  return (
    <div className="auth-form-stack auth-register-stack">
      <SocialButtons mode="register" />
      <AuthDivider />
      <form action={action} className="auth-form auth-register-form" noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
        <div className="auth-register-grid">
          <FormRow label="Minecraft username" htmlFor="username" error={usernameError}>
            <FieldShell icon={<UserRound size={17} />}>
              <Input id="username" name="username" required minLength={3} maxLength={16} pattern="[A-Za-z0-9_]+" placeholder="NovaCrafter" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(usernameError)} aria-describedby={usernameError ? "username-error" : undefined} className="auth-field" />
            </FieldShell>
          </FormRow>
          <FormRow label="Email address" htmlFor="email" error={emailError}>
            <FieldShell icon={<AtSign size={17} />}>
              <Input id="email" name="email" type="email" required maxLength={254} placeholder="you@example.com" autoComplete="email" inputMode="email" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "email-error" : undefined} className="auth-field" />
            </FieldShell>
          </FormRow>
        </div>
        <div className="auth-register-grid auth-register-passwords">
          <FormRow label="Create password" htmlFor="password" error={passwordError}>
            <PasswordInput id="password" name="password" placeholder="Create password" autoComplete="new-password" error={passwordError} onValueChange={setPasswordValue} />
          </FormRow>
          <FormRow label="Confirm password" htmlFor="confirm" error={confirmError}>
            <PasswordInput id="confirm" name="confirm" placeholder="Repeat password" autoComplete="new-password" error={confirmError} />
          </FormRow>
        </div>
        <PasswordRules value={passwordValue} />
        <label className="auth-terms auth-register-terms">
          <input type="checkbox" name="terms" required aria-invalid={Boolean(termsError)} aria-describedby={termsError ? "terms-error" : undefined} />
          <span>
            I agree to the <Link href="/rules">community rules</Link> and <Link href="/support">terms of service</Link>.
            {termsError && <small id="terms-error" role="alert">{termsError}</small>}
          </span>
        </label>
        <AuthMessage message={validation.message} />
        <button type="submit" disabled={pending} className="btn btn-primary auth-submit auth-account-submit disabled:opacity-70">
          <span className="auth-account-submit-icon">
            {pending ? <Loader2 size={17} className="animate-spin" /> : <BadgeCheck size={17} />}
          </span>
          <span className="auth-account-submit-copy">
            <strong>{pending ? "Creating account…" : "Create account"}</strong>
            <small>Start your Mazora journey</small>
          </span>
          <span className="auth-account-submit-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
        </button>
      </form>
      <p className="auth-switch-copy">
        <span>Already have an account?</span>
        <AuthFlowLink view="login" href="/login">Log in</AuthFlowLink>
      </p>
    </div>
  );
}

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  const validation = useClientValidation(resetRequestSchema, state);
  const emailError = validation.errorFor("email");
  if (state.ok) {
    return (
      <div className="auth-success-state">
        <span><Send size={25} /></span>
        <h2>Check your inbox</h2>
        <p>If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.</p>
        <AuthFlowLink view="login" href="/login" className="btn btn-ghost auth-submit">Back to login</AuthFlowLink>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form" noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
      <FormRow label="Account email" htmlFor="email" error={emailError}>
        <FieldShell icon={<AtSign size={17} />}>
          <Input id="email" name="email" type="email" required maxLength={254} placeholder="you@example.com" autoComplete="email" inputMode="email" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "email-error" : undefined} className="auth-field" />
        </FieldShell>
      </FormRow>
      <AuthMessage message={validation.message} />
      <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} Send reset link <ArrowRight size={16} className="ml-auto" />
      </button>
      <p className="auth-switch-copy">Remembered it? <AuthFlowLink view="login" href="/login">Log in</AuthFlowLink></p>
    </form>
  );
}

export function PasswordResetForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  const validation = useClientValidation(newPasswordSchema, state);
  const passwordError = validation.errorFor("password");
  const confirmError = validation.errorFor("confirm");
  if (state.ok) {
    return (
      <div className="auth-success-state">
        <span><ShieldCheckIcon /></span>
        <h2>Password updated</h2>
        <p>Your password has been reset. You can now log in with your new password.</p>
        <Link href="/login" className="btn btn-primary auth-submit">Continue to login <ArrowRight size={16} /></Link>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form" noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
      <FormRow label="New password" htmlFor="password" error={passwordError}>
        <PasswordInput id="password" name="password" placeholder="Create a secure password" autoComplete="new-password" error={passwordError} strength />
      </FormRow>
      <FormRow label="Confirm new password" htmlFor="confirm" error={confirmError}>
        <PasswordInput id="confirm" name="confirm" placeholder="Repeat your new password" autoComplete="new-password" error={confirmError} />
      </FormRow>
      <AuthMessage message={validation.message} />
      <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />} Reset password <ArrowRight size={16} className="ml-auto" />
      </button>
    </form>
  );
}

function ShieldCheckIcon() {
  return <BadgeCheck size={25} />;
}
