import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Public-facing empty state. Used wherever a section has no real content yet —
 * the page says so plainly instead of rendering a blank gap or sample content.
 */
export function EmptyState({
  icon,
  title,
  message,
  cta,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="glass flex flex-col items-center px-6 py-16 text-center">
      {icon && (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line-strong bg-ink/5 text-muted">
          {icon}
        </span>
      )}
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted">{message}</p>
      {cta && (
        <Link href={cta.href} className="btn btn-ghost btn-sm mt-5">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
