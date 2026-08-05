import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Standard interior-page hero band with eyebrow, title, lead copy, optional floating illustration, optional back link, and optional children. */
export function PageHero({
  eyebrow,
  title,
  lead,
  illustration,
  children,
  backLink,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  illustration?: ReactNode;
  children?: ReactNode;
  backLink?: { href: string; label: string };
}) {
  return (
    <section className="page-hero">
      <div className="page-hero-atmosphere" aria-hidden="true" />
      <div className="page-hero-inner shell">
        {backLink && (
          <div className="mb-4">
            <Link
              href={backLink.href}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-slate-800 dark:text-purple-200 bg-white/90 dark:bg-purple-950/60 border border-slate-300 dark:border-purple-500/30 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 dark:hover:text-white hover:border-purple-600 shadow-sm backdrop-blur-xl transition-all duration-200 group"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1 text-purple-600 dark:text-purple-400 group-hover:text-white" />
              {backLink.label}
            </Link>
          </div>
        )}
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
