import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(48rem_28rem_at_50%_-10%,rgba(139,92,246,0.12),transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> Home
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
