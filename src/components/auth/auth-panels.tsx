"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { otpTypes } from "@/lib/validation/auth";
import { AuthCard } from "./auth-card";
import { AuthFlowLink } from "./auth-dialog-provider";
import { ConfirmEmailForm, ForgotPasswordFlow, LoginForm, PasswordResetForm, RegisterForm, VerifyEmailCodeForm } from "./auth-forms";

const loginErrors: Record<string, string> = {
  oauth_failed: "Social login could not be completed. Please try again.",
  session_expired: "Your sign-in session expired. Please start again.",
};

export function LoginPanel({ next, error }: { next?: string; error?: string }) {
  return (
    <AuthCard kicker="Player portal" title="Welcome back." subtitle="Your worlds, purchases, events, and community identity—one secure sign-in away.">
      {error && <p className="auth-form-message mb-4" role="alert">{loginErrors[error] ?? "Sign in could not be completed."}</p>}
      <LoginForm next={next} />
    </AuthCard>
  );
}

export function RegisterPanel() {
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  // No navigation on success: registerAction returns { ok: true } without a
  // redirect so this swaps to the "check your inbox" state in place, instead
  // of routing through /?auth=verify-email — which would force a full
  // re-render of the underlying page (live player/Discord counts included)
  // before the popup could even mount.
  if (verifyEmail !== null) return <VerifyEmailPanel email={verifyEmail} />;

  return (
    <AuthCard kicker="Create your identity" title="Join the network." subtitle="One free account for your progress, events, forums, and support.">
      <RegisterForm onRegistered={setVerifyEmail} />
    </AuthCard>
  );
}

export function ForgotPasswordPanel() {
  return <ForgotPasswordFlow />;
}

export function VerifyEmailPanel({ email }: { email?: string }) {
  return (
    <AuthCard
      kicker="Final checkpoint"
      title="Enter your secure code."
      subtitle={
        email
          ? "Use the six-digit code we sent to activate your Mazora identity."
          : "We've sent a verification code to your email address."
      }
    >
      {email ? (
        // The normal post-register path has the email, so show the code entry.
        <VerifyEmailCodeForm email={email} />
      ) : (
        // Reached via the bare /verify-email URL with no email in context: fall
        // back to the guidance state (the email also carries a one-click link).
        <div className="auth-success-state">
          <span>
            <MailCheck size={26} />
          </span>
          <h2>Verify your email</h2>
          <p>
            Open the email and enter the 6-digit code, or click <strong>Confirm email address</strong>. Didn&apos;t get
            it? Check your spam folder, or try logging in to resend the confirmation.
          </p>
          <AuthFlowLink view="login" href="/login" className="btn btn-ghost auth-submit">
            Back to login
          </AuthFlowLink>
        </div>
      )}
    </AuthCard>
  );
}

export function ConfirmEmailPanel({ tokenHash, type }: { tokenHash?: string; type?: string }) {
  const isValid = Boolean(tokenHash) && Boolean(type) && (otpTypes as readonly string[]).includes(type ?? "");

  if (!isValid) {
    return (
      <AuthCard kicker="Final checkpoint" title="Link invalid or expired." subtitle="This confirmation link can't be used.">
        <div className="auth-success-state">
          <p>
            This link is missing or no longer valid. Request a new one by signing in again, or from your account
            settings once you&apos;re logged in.
          </p>
          <AuthFlowLink view="login" href="/login" className="btn btn-primary auth-submit">
            Back to login
          </AuthFlowLink>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard kicker="Final checkpoint" title="Confirm your email." subtitle="Click below to finish verifying your account.">
      <ConfirmEmailForm tokenHash={tokenHash!} type={type!} />
    </AuthCard>
  );
}

export function ResetPasswordPanel() {
  return (
    <AuthCard kicker="Security checkpoint" title="Create a new password." subtitle="Choose something unique to Mazora that you don't use anywhere else.">
      <PasswordResetForm />
    </AuthCard>
  );
}
