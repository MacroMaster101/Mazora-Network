"use client";

import { AuthCard } from "./auth-card";
import { LoginForm, PasswordResetRequestForm, RegisterForm } from "./auth-forms";

const loginErrors: Record<string, string> = {
  oauth_failed: "Social login could not be completed. Please try again.",
  session_expired: "Your sign-in session expired. Please start again.",
};

export function LoginPanel({ next, error }: { next?: string; error?: string }) {
  return (
    <AuthCard kicker="Player portal" title="Welcome back, adventurer." subtitle="Sign in to continue your journey across every Mazora world.">
      {error && <p className="auth-form-message mb-4" role="alert">{loginErrors[error] ?? "Sign in could not be completed."}</p>}
      <LoginForm next={next} />
    </AuthCard>
  );
}

export function RegisterPanel() {
  return (
    <AuthCard kicker="Create your identity" title="Join the network." subtitle="One free account for your progress, events, forums, and support.">
      <RegisterForm />
    </AuthCard>
  );
}

export function ForgotPasswordPanel() {
  return (
    <AuthCard kicker="Account recovery" title="Find your way back." subtitle="Enter your account email and we'll send you a secure reset link.">
      <PasswordResetRequestForm />
    </AuthCard>
  );
}
