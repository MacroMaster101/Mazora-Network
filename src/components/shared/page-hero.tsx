import type { ReactNode } from "react";

/** Standard interior-page hero band with eyebrow, title, lead copy, optional floating illustration, and optional children. */
export function PageHero({
  eyebrow,
  title,
  lead,
  illustration,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  illustration?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="page-hero-atmosphere" aria-hidden="true" />
      <div className="page-hero-inner shell">
        <div className="flex flex-col-reverse md:flex-row items-center md:items-center justify-between gap-6 md:gap-8">
          <div className="max-w-2xl w-full">
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            <h1 className="text-balance text-3xl font-extrabold sm:text-4xl md:text-5xl">{title}</h1>
            {lead && <p className="mt-4 text-pretty text-base sm:text-lg text-muted">{lead}</p>}
            {children && <div className="mt-6">{children}</div>}
          </div>
          {illustration && (
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full pointer-events-none" />
              {illustration}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
