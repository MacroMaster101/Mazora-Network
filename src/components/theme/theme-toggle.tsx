"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "./theme-provider";
import { cn } from "@/lib/utils";

const options: { value: ThemeChoice; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("inline-flex items-center gap-0.5 rounded-lg border border-line-strong bg-ink/5 p-0.5", className)}
    >
      {options.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            aria-pressed={active}
            aria-label={`${o.label} theme`}
            title={`${o.label} theme`}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md transition-colors",
              active ? "bg-accent/15 text-accent-bright" : "text-muted hover:text-ink",
            )}
          >
            <o.icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
