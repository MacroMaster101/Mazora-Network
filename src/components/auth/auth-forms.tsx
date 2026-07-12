"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, MessagesSquare } from "lucide-react";
import { loginAction, registerAction, type AuthResult } from "@/lib/actions/auth";
import { FormRow, Input } from "@/components/ui";

const initial: AuthResult = { ok: false };

function SocialButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" disabled title="Available in a future update" className="btn btn-ghost cursor-not-allowed opacity-60">
        <Mail size={16} /> Google
      </button>
      <button type="button" disabled title="Available in a future update" className="btn btn-ghost cursor-not-allowed opacity-60">
        <MessagesSquare size={16} /> Discord
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4">
      <SocialButtons />
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>
      {next && <input type="hidden" name="next" value={next} />}
      <FormRow label="Email or username" htmlFor="identifier" error={state.errors?.identifier}>
        <Input id="identifier" name="identifier" placeholder="you@example.com" autoComplete="username" />
      </FormRow>
      <FormRow label="Password" htmlFor="password" error={state.errors?.password}>
        <Input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
      </FormRow>
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-muted">
          <input type="checkbox" name="remember" className="h-4 w-4 accent-[#8b5cf6]" /> Remember me
        </label>
        <Link href="/forgot-password" className="text-accent-bright">
          Forgot password?
        </Link>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-70">
        {pending && <Loader2 size={16} className="animate-spin" />} Log in
      </button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-semibold text-accent-bright">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action} className="space-y-4">
      <SocialButtons />
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Username" htmlFor="username" error={state.errors?.username}>
          <Input id="username" name="username" placeholder="NovaCrafter" autoComplete="username" />
        </FormRow>
        <FormRow label="Display name" htmlFor="displayName" error={state.errors?.displayName}>
          <Input id="displayName" name="displayName" placeholder="Nova" />
        </FormRow>
      </div>
      <FormRow label="Email" htmlFor="email" error={state.errors?.email}>
        <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
      </FormRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Password" htmlFor="password" error={state.errors?.password}>
          <Input id="password" name="password" type="password" placeholder="Min. 8 characters" autoComplete="new-password" />
        </FormRow>
        <FormRow label="Confirm password" htmlFor="confirm" error={state.errors?.confirm}>
          <Input id="confirm" name="confirm" type="password" placeholder="Repeat password" autoComplete="new-password" />
        </FormRow>
      </div>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 accent-[#8b5cf6]" />
        <span>
          I accept the community rules and terms.
          {state.errors?.terms && <span className="mt-1 block text-danger">{state.errors.terms}</span>}
        </span>
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-70">
        {pending && <Loader2 size={16} className="animate-spin" />} Create account
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent-bright">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function PasswordResetRequestForm() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">
          If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.
        </p>
        <Link href="/login" className="btn btn-ghost mt-5 w-full">
          Back to login
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="space-y-4"
    >
      <FormRow label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
      </FormRow>
      <button type="submit" className="btn btn-primary w-full">
        Send reset link
      </button>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-accent-bright">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function PasswordResetForm() {
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">Your password has been reset. You can now log in with your new password.</p>
        <Link href="/login" className="btn btn-primary mt-5 w-full">
          Continue to login
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="space-y-4"
    >
      <FormRow label="New password" htmlFor="password">
        <Input id="password" name="password" type="password" required placeholder="Min. 8 characters" autoComplete="new-password" />
      </FormRow>
      <FormRow label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" required placeholder="Repeat password" autoComplete="new-password" />
      </FormRow>
      <button type="submit" className="btn btn-primary w-full">
        Reset password
      </button>
    </form>
  );
}
