import type { ReactNode } from "react";

/** Standard interior-page hero band with an eyebrow, title, and lead copy. */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(50rem_24rem_at_50%_-20%,rgba(139,92,246,0.12),transparent_60%)]" />
      <div className="shell relative py-14 sm:py-20">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="max-w-3xl text-balance text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {lead && <p className="mt-4 max-w-2xl text-pretty text-lg text-muted">{lead}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
