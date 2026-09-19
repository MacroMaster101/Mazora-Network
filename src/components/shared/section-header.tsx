import Link from "@/components/ui/app-link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  eyebrow,
  title,
  copy,
  href,
  action,
  center,
  fieldIds,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  href?: string;
  action?: string;
  center?: boolean;
  fieldIds?: { eyebrow?: string; title?: string; copy?: string; action?: string };
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "flex flex-wrap items-end justify-between gap-4"}>
      <div className={center ? "" : "max-w-2xl"}>
        {eyebrow && <p className="eyebrow mb-3" data-page-field={fieldIds?.eyebrow}>{eyebrow}</p>}
        <h2 className="text-balance text-3xl font-bold sm:text-4xl" data-page-field={fieldIds?.title}>{title}</h2>
        {copy && <p className="mt-3 text-pretty text-muted" data-page-field={fieldIds?.copy}>{copy}</p>}
      </div>
      {href && action && (
        <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-accent-bright">
          <span data-page-field={fieldIds?.action}>{action}</span>
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
