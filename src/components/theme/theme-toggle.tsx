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

export function ThemeCycleButton({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === "dark";
  const Icon = isDark ? Moon : Sun;
  const nextTheme = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={cn("theme-orb", className)}
    >
      <span className="theme-orb-glow" aria-hidden="true" />
      <Icon size={17} className="relative z-10" />
    </button>
  );
}
