import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Consistent, prefetchable back navigation for public detail pages. */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "group inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300/90 bg-white/90 px-4 py-2 text-[0.8rem] font-extrabold text-slate-900 shadow-[0_12px_30px_-22px_rgba(30,41,59,0.9)] backdrop-blur-xl transition-[transform,border-color,background-color,color,box-shadow] duration-200 hover:-translate-x-0.5 hover:border-violet-600 hover:bg-violet-600 hover:text-white hover:shadow-[0_16px_34px_-20px_rgba(124,58,237,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:border-violet-400/35 dark:bg-[#120b20]/85 dark:text-violet-100 dark:hover:border-violet-400 dark:hover:bg-violet-600 dark:hover:text-white",
        className,
      )}
    >
      <ArrowLeft
        size={15}
        aria-hidden="true"
        className="shrink-0 text-violet-600 transition-transform group-hover:-translate-x-0.5 group-hover:text-white dark:text-violet-300"
      />
      <span>{label}</span>
    </Link>
  );
}
