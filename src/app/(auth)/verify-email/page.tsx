import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard kicker="Final checkpoint" title="Check your inbox." subtitle="We've sent a verification link to your email address.">
      <div className="auth-success-state">
        <span>
          <MailCheck size={26} />
        </span>
        <h2>Verify your email</h2>
        <p>
          Click the link in the email to activate your account. Didn&apos;t get it? Check spam, or request a new link from
          your settings after logging in.
        </p>
        <Link href="/login" className="btn btn-ghost auth-submit">
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}
