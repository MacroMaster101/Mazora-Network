import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  eyebrow,
  title,
  copy,
  href,
  action,
  center,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  href?: string;
  action?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "flex flex-wrap items-end justify-between gap-4"}>
      <div className={center ? "" : "max-w-2xl"}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="text-balance text-3xl font-bold sm:text-4xl">{title}</h2>
        {copy && <p className="mt-3 text-pretty text-muted">{copy}</p>}
      </div>
      {href && action && (
        <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-accent-bright">
          {action}
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
