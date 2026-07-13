import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard kicker="Secure your account" title="Choose a new password." subtitle="Use a strong password you don't use anywhere else.">
      <PasswordResetForm />
    </AuthCard>
  );
}
