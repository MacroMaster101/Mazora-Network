import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Check your inbox" subtitle="We've sent a verification link to your email address.">
      <div className="flex flex-col items-center py-2 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
          <MailCheck size={26} />
        </span>
        <p className="mt-4 text-sm text-muted">
          Click the link in the email to activate your account. Didn&apos;t get it? Check spam, or request a new link from
          your settings after logging in.
        </p>
        <Link href="/login" className="btn btn-ghost mt-6 w-full">
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}
