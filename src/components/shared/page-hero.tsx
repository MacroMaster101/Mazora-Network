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
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="page-hero-atmosphere" aria-hidden="true" />
      <div className="page-hero-inner shell">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="max-w-3xl text-balance text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {lead && <p className="mt-4 max-w-2xl text-pretty text-lg text-muted">{lead}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
