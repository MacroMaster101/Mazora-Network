"use client";

import { useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { ZodTypeAny } from "zod";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  confirmEmailAction,
  finishPasswordResetAction,
  loginAction,
  oauthAction,
  registerAction,
  requestPasswordResetAction,
  resendConfirmationAction,
  verifyResetCodeAction,
  type AuthResult,
} from "@/lib/actions/auth";
import { FormRow, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  authValidationErrors,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetRequestSchema,
} from "@/lib/validation/auth";
import { AuthCard } from "./auth-card";
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
  // Same scoring + label set as the dashboard's PasswordStrengthMini
  // (account-security.tsx), so the strength meter reads identically whether
  // you're setting a password here or from account settings.
  const score = value
    ? [value.length >= 8, value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /[^a-zA-Z]/.test(value)].filter(Boolean).length
    : 0;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  return (
    <div id={id} className="auth-password-strength" data-score={score} aria-live="polite">
      <span className="sr-only">Password strength: {labels[score]}</span>
      <div aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => <i key={segment} className={segment <= score ? "is-filled" : undefined} />)}
      </div>
      {value && <p>{labels[score]}</p>}
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

function SocialButtons({ next = "/", mode = "login" }: { next?: string; mode?: "login" | "register" }) {
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

function ResendConfirmationRow({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmationAction, initial);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message, "success");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else if (!state.ok && state.message) {
      toast(state.message, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  return (
    <form action={action} className="auth-resend-row">
      <input type="hidden" name="email" value={email} />
      <button type="submit" disabled={pending || cooldown > 0} className="btn btn-ghost auth-submit disabled:opacity-60">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {pending ? "Sending…" : cooldown > 0 ? `Resend confirmation in ${cooldown}s` : "Resend confirmation email"}
      </button>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const validation = useClientValidation(loginSchema, state);
  const emailError = validation.errorFor("identifier");
  const passwordError = validation.errorFor("password");
  // React resets the form once the action resolves. The email is controlled so
  // it survives a rejected attempt; the password is deliberately cleared (by
  // remounting PasswordInput) and refocused so the retry starts in the right
  // field. Client-side validation calls preventDefault, so `state` only ever
  // changes on a genuine server rejection.
  const [email, setEmail] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (state.ok || (!state.message && !state.errors)) return;
    setAttempt((current) => current + 1);
    requestAnimationFrame(() => document.getElementById("password")?.focus());
  }, [state]);
  return (
    <div className="auth-form-stack">
      <SocialButtons next={next} />
      <AuthDivider />
      <form action={action} className="auth-form" noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
        {next && <input type="hidden" name="next" value={next} />}
        <FormRow label="Email address" htmlFor="identifier" error={emailError}>
          <FieldShell icon={<UserRound size={17} />}>
            <Input id="identifier" name="identifier" type="email" required maxLength={254} placeholder="you@example.com" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "identifier-error" : undefined} className="auth-field" />
          </FieldShell>
        </FormRow>
        <FormRow label="Password" htmlFor="password" error={passwordError}>
          <PasswordInput key={attempt} id="password" name="password" placeholder="Enter your password" autoComplete="current-password" error={passwordError} />
        </FormRow>
        <AuthMessage message={validation.message} />
        <div className="auth-form-options">
          <label className="auth-remember">
            <input type="checkbox" name="remember" />
            <span>Remember me</span>
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
      {state.unverifiedEmail && <ResendConfirmationRow email={state.unverifiedEmail} />}
      <p className="auth-switch-copy">
        <span>New to Mazora?</span>
        <AuthFlowLink view="register" href="/register">Create an account</AuthFlowLink>
      </p>
    </div>
  );
}

function LegalPreviewModal({
  type,
  onClose,
}: {
  type: "rules" | "terms";
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  const isRules = type === "rules";

  return createPortal(
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-white/15 bg-[#120a21] text-white shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent-bright">
              {isRules ? <ShieldCheck size={18} /> : <FileText size={18} />}
            </span>
            <h3 className="font-display text-lg font-bold">
              {isRules ? "Community Rules Preview" : "Terms of Service Preview"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm leading-relaxed text-white/80">
          {isRules ? (
            <>
              <p className="text-white/60 text-xs">
                Our rules keep the network fair, friendly, and fun for everyone.
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">1. Respect & Courtesy</h4>
                  <p className="text-xs text-white/70">
                    No harassment, hate speech, toxicity, or personal attacks across server chat, Discord, or forums.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">2. Fair Play & Anti-Cheat</h4>
                  <p className="text-xs text-white/70">
                    Hacked clients, X-Ray, macros, auto-clickers, and bug exploitation are strictly prohibited.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">3. Chat & Advertising</h4>
                  <p className="text-xs text-white/70">
                    No spamming, advertising external servers, or sharing unsafe/malicious links.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">4. Account & Trading</h4>
                  <p className="text-xs text-white/70">
                    Real-money trading (RMT) outside the official Mazora store is forbidden. Keep account details secure.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-white/60 text-xs">
                By using Mazora Network, you agree to these fundamental terms.
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">1. Acceptance of Terms</h4>
                  <p className="text-xs text-white/70">
                    By registering or accessing Mazora services, you agree to comply with our Terms & Community Rules.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">2. Account Responsibility</h4>
                  <p className="text-xs text-white/70">
                    You are solely responsible for activities on your account. Keep passwords and tokens confidential.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">3. Virtual Items & Purchases</h4>
                  <p className="text-xs text-white/70">
                    All store purchases are final digital licenses. Chargebacks or fraud lead to permanent account suspension.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white mb-1">4. Service Availability & Resets</h4>
                  <p className="text-xs text-white/70">
                    Mazora reserves the right to perform network maintenance, seasonal resets, or updates as necessary.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 bg-white/5">
          <Link
            href={isRules ? "/rules" : "/terms"}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent-bright hover:underline flex items-center gap-1"
          >
            Open full {isRules ? "Rulebook" : "Terms"} in new tab <ExternalLink size={12} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary text-xs py-1.5 px-4"
          >
            Understand & Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function RegisterForm({ onRegistered }: { onRegistered: (email: string) => void }) {
  const [state, action, pending] = useActionState(registerAction, initial);
  const [passwordValue, setPasswordValue] = useState("");
  const [email, setEmail] = useState("");
  const [previewType, setPreviewType] = useState<"rules" | "terms" | null>(null);
  const validation = useClientValidation(registerSchema, state);
  const usernameError = validation.errorFor("username");
  const emailError = validation.errorFor("email");
  const passwordError = validation.errorFor("password");
  const confirmError = validation.errorFor("confirm");
  const termsError = validation.errorFor("terms");

  useEffect(() => {
    if (state.ok) onRegistered(email);
    // Only fire once the server confirms success — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const handleOpenPreview = (e: React.MouseEvent, type: "rules" | "terms") => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewType(type);
  };

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
              <Input id="email" name="email" type="email" required maxLength={254} placeholder="you@example.com" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "email-error" : undefined} className="auth-field" />
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
            I agree to the{" "}
            <a
              href="/rules"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => handleOpenPreview(e, "rules")}
              className="text-accent-bright hover:underline cursor-pointer"
            >
              community rules
            </a>{" "}
            and{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => handleOpenPreview(e, "terms")}
              className="text-accent-bright hover:underline cursor-pointer"
            >
              terms of service
            </a>.
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

      {previewType && (
        <LegalPreviewModal type={previewType} onClose={() => setPreviewType(null)} />
      )}
    </div>
  );
}

function RequestResetCodeForm({ onSent }: { onSent: (email: string) => void }) {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  const [email, setEmail] = useState("");
  const validation = useClientValidation(resetRequestSchema, state);
  const emailError = validation.errorFor("email");

  useEffect(() => {
    if (state.ok) onSent(email);
    // Only fire when the server confirms the request went through — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form action={action} className="auth-form" noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
      <FormRow label="Account email" htmlFor="email" error={emailError}>
        <FieldShell icon={<AtSign size={17} />}>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "email-error" : undefined}
            className="auth-field"
          />
        </FieldShell>
      </FormRow>
      <AuthMessage message={validation.message} />
      <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} Send code <ArrowRight size={16} className="ml-auto" />
      </button>
      <p className="auth-switch-copy">Remembered it? <AuthFlowLink view="login" href="/login">Log in</AuthFlowLink></p>
    </form>
  );
}

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyResetCodeForm({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [state, action, pending] = useActionState(verifyResetCodeAction, initial);
  const [resendState, resendAction, resendPending] = useActionState(requestPasswordResetAction, initial);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const { toast } = useToast();
  const tokenError = state.errors?.token;

  useEffect(() => {
    if (state.ok) onVerified();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  useEffect(() => {
    if (resendState.ok) {
      toast("A new code has been sent.", "success");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resendState.ok]);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  return (
    <>
      <form action={action} className="auth-form" noValidate>
        <input type="hidden" name="email" value={email} />
        <FormRow label="6-digit code" htmlFor="reset-token" error={tokenError}>
          <FieldShell icon={<KeyRound size={17} />}>
            <Input
              id="reset-token"
              name="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              placeholder="123456"
              autoComplete="one-time-code"
              aria-invalid={Boolean(tokenError)}
              aria-describedby={tokenError ? "reset-token-error" : undefined}
              className="auth-field"
            />
          </FieldShell>
        </FormRow>
        <AuthMessage message={state.message} />
        <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
          {pending ? <Loader2 size={17} className="animate-spin" /> : <BadgeCheck size={17} />} Verify code <ArrowRight size={16} className="ml-auto" />
        </button>
      </form>
      <form action={resendAction} className="auth-resend-row">
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={resendPending || cooldown > 0} className="btn btn-ghost auth-submit disabled:opacity-60">
          {resendPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {resendPending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </form>
    </>
  );
}

function NewPasswordAfterResetForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(finishPasswordResetAction, initial);
  const validation = useClientValidation(newPasswordSchema, state);
  const passwordError = validation.errorFor("password");
  const confirmError = validation.errorFor("confirm");

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form action={action} className="auth-form" noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
      <FormRow label="New password" htmlFor="reset-new-password" error={passwordError}>
        <PasswordInput id="reset-new-password" name="password" placeholder="Create a secure password" autoComplete="new-password" error={passwordError} strength />
      </FormRow>
      <FormRow label="Confirm new password" htmlFor="reset-new-confirm" error={confirmError}>
        <PasswordInput id="reset-new-confirm" name="confirm" placeholder="Repeat your new password" autoComplete="new-password" error={confirmError} />
      </FormRow>
      <AuthMessage message={validation.message} />
      <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />} Reset password <ArrowRight size={16} className="ml-auto" />
      </button>
    </form>
  );
}

type ForgotStep = "email" | "code" | "password" | "done";

export function ForgotPasswordFlow() {
  const [step, setStep] = useState<ForgotStep>("email");
  const [email, setEmail] = useState("");

  if (step === "code") {
    return (
      <AuthCard kicker="Account recovery" title="Enter your code." subtitle={`We sent a 6-digit code to ${email}.`}>
        <VerifyResetCodeForm email={email} onVerified={() => setStep("password")} />
      </AuthCard>
    );
  }

  if (step === "password") {
    return (
      <AuthCard kicker="Account recovery" title="Choose a new password." subtitle="Use a strong password you don't use anywhere else.">
        <NewPasswordAfterResetForm onDone={() => setStep("done")} />
      </AuthCard>
    );
  }

  if (step === "done") {
    return (
      <AuthCard kicker="Account recovery" title="Password updated." subtitle="You can now log in with your new password.">
        <div className="auth-success-state">
          <span><ShieldCheckIcon /></span>
          <h2>All set</h2>
          <p>Your password has been reset. Log in with your new password to continue.</p>
          <AuthFlowLink view="login" href="/login" className="btn btn-primary auth-submit">
            Back to login <ArrowRight size={16} />
          </AuthFlowLink>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard kicker="Account recovery" title="Find your way back." subtitle="Enter your account email and we'll send you a 6-digit code.">
      <RequestResetCodeForm
        onSent={(sentEmail) => {
          setEmail(sentEmail);
          setStep("code");
        }}
      />
    </AuthCard>
  );
}

export function PasswordResetForm() {
  // finishPasswordResetAction (not updatePasswordAction): this page is reached
  // via the recovery fallback link (/confirm-email?type=recovery -> here), and
  // finishPasswordResetAction signs the user out after the change so they log
  // back in fresh — matching the 6-digit-code recovery path exactly.
  const [state, action, pending] = useActionState(finishPasswordResetAction, initial);
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

export function ConfirmEmailForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, action, pending] = useActionState(confirmEmailAction, initial);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <AuthMessage message={state.message} />
      <button type="submit" disabled={pending} className="btn btn-primary auth-submit disabled:opacity-70">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <BadgeCheck size={17} />} Confirm my email
        <ArrowRight size={16} className="ml-auto" />
      </button>
      <p className="auth-switch-copy">
        Wrong account? <AuthFlowLink view="login" href="/login">Log in</AuthFlowLink>
      </p>
    </form>
  );
}
