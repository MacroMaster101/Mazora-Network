import type { Accent } from "@/lib/types";
import { accentStyles, coverGradient } from "./accent";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

/** Cinematic self-contained cover art for cards (no external images needed). */
export function CoverArt({
  accent,
  icon,
  className,
  height = "h-40",
  label,
}: {
  accent: Accent;
  icon?: string;
  className?: string;
  height?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", height, className)}
      style={{ backgroundImage: coverGradient(accent) }}
    >
      <div className="absolute inset-0 opacity-[0.15] [background:linear-gradient(rgb(var(--ink)/0.45)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--ink)/0.45)_1px,transparent_1px)] [background-size:22px_22px]" />
      {icon && (
        <div className="absolute inset-0 grid place-items-center">
          <Icon name={icon} size={44} className={cn(accentStyles[accent].text, "opacity-90")} />
        </div>
      )}
      {label && (
        <span className="telemetry absolute bottom-2 left-3 text-[10px] uppercase tracking-widest text-white/50">
          {label}
        </span>
      )}
    </div>
  );
}
