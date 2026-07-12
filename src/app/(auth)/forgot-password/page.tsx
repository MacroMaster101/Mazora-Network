import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetRequestForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" subtitle="Enter your email and we'll send you a reset link.">
      <PasswordResetRequestForm />
    </AuthCard>
  );
}
