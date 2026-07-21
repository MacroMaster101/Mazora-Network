"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { updatePasswordAction, type AuthResult } from "@/lib/actions/auth";
import { FormRow, Input, useToast } from "@/components/ui";

const initialAuth: AuthResult = { ok: false };

interface AccountSecurityProps {
  hasPassword: boolean;
}

function PasswordStrengthMini({ value }: { value: string }) {
  const score = value
    ? [value.length >= 8, value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /[^a-zA-Z]/.test(value)].filter(Boolean).length
    : 0;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-danger", "bg-danger", "bg-amber-500", "bg-accent-bright", "bg-success"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors ${segment <= score ? colors[score] : "bg-ink/10"}`}
          />
        ))}
      </div>
      {value && <span className="text-[10px] font-semibold text-muted">{labels[score]}</span>}
    </div>
  );
}

export function AccountSecurity({ hasPassword }: AccountSecurityProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialAuth);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message, "success");
      setIsOpen(false);
      setPassword("");
      setConfirm("");
      // Re-run the settings server component so the "Set a password" /
      // "Change password" label reflects the just-updated has_password flag
      // without requiring the user to manually reload the page.
      router.refresh();
    } else if (!state.ok && state.message) {
      toast(state.message, "error");
    }
  }, [state, toast, router]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold transition hover:border-accent/50 hover:text-accent-bright"
      >
        <KeyRound size={13} />
        {hasPassword ? "Change password" : "Set a password"}
      </button>
    );
  }

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;
  const canSubmit = password.length >= 8 && password === confirm;

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-line-strong bg-ink/5 p-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <LockKeyhole size={15} className="text-accent-bright" />
        {hasPassword ? "Change password" : "Set a password"}
      </div>
      <p className="text-xs text-muted">
        {hasPassword
          ? "Enter your new password below."
          : "Set a password so you can also sign in with your email address."}
      </p>

      <FormRow label="New password" htmlFor="settings-password" error={tooShort ? "Must be at least 8 characters" : state.errors?.password}>
        <div className="relative">
          <Input
            id="settings-password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a secure password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            aria-invalid={tooShort}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {password && <PasswordStrengthMini value={password} />}
      </FormRow>

      <FormRow label="Confirm password" htmlFor="settings-confirm" error={mismatch ? "Passwords do not match" : state.errors?.confirm}>
        <div className="relative">
          <Input
            id="settings-confirm"
            name="confirm"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            aria-invalid={mismatch}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </FormRow>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit || pending}
          className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ShieldCheck size={14} />
          )}
          {pending ? "Saving…" : hasPassword ? "Update password" : "Set password"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setPassword("");
            setConfirm("");
          }}
          className="btn btn-ghost btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
