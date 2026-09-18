import type { ReactNode } from "react";

/** The header and error notice every forum dialog shares. */
export function DialogHeader({ icon, eyebrow, title, lead }: { icon: ReactNode; eyebrow: string; title: string; lead: string }) {
  return (
    <header className="relative overflow-hidden border-b border-line px-6 py-5 pr-16 sm:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(var(--accent-rgb)/0.18),transparent_52%)]" aria-hidden="true" />
      <div className="relative flex gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent-bright">
          {icon}
        </span>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-muted">{lead}</p>
        </div>
      </div>
    </header>
  );
}

export function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
      {message}
    </p>
  );
}
