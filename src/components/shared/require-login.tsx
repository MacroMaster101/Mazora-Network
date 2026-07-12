import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { getSession } from "@/lib/auth";

/**
 * Server-side login gate. Renders children only for signed-in users; otherwise
 * shows a friendly prompt. Real enforcement also lives in each server action.
 */
export async function RequireLogin({ next, children }: { next: string; children: ReactNode }) {
  const session = await getSession();
  if (session) return <>{children}</>;
  return (
    <div className="glass flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-xl border border-line-strong bg-ink/5 text-muted">
        <LockKeyhole size={24} />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold">Please log in to continue</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">You need an account to submit this form. It only takes a moment.</p>
      <div className="mt-6 flex gap-3">
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary">
          Log in
        </Link>
        <Link href="/register" className="btn btn-ghost">
          Create account
        </Link>
      </div>
    </div>
  );
}
