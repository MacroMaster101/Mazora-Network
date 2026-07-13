"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark";
export const THEME_KEY = "mz-theme";

interface ThemeCtx {
  theme: ThemeChoice;
  resolved: "light" | "dark";
  setTheme: (t: ThemeChoice) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) return { theme: "dark", resolved: "dark", setTheme: () => {} };
  return ctx;
}

function preferredTheme(): ThemeChoice {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  const apply = useCallback((t: ThemeChoice) => {
    document.documentElement.setAttribute("data-theme", t);
    setResolved(t);
  }, []);

  // Hydrate from a saved choice. First-time visitors inherit their OS preference.
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const selected = stored === "light" || stored === "dark" ? stored : preferredTheme();
    setThemeState(selected);
    apply(selected);

    // Remove the old three-state value so future visits use the simpler behavior.
    if (stored === "system") localStorage.removeItem(THEME_KEY);
  }, [apply]);

  const setTheme = useCallback(
    (t: ThemeChoice) => {
      localStorage.setItem(THEME_KEY, t);
      setThemeState(t);
      apply(t);
    },
    [apply],
  );

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

/** Inline script that sets data-theme before first paint (no light/dark flash). */
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
