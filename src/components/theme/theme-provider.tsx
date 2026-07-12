"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "mz-theme";

interface ThemeCtx {
  theme: ThemeChoice;
  resolved: "light" | "dark";
  setTheme: (t: ThemeChoice) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) return { theme: "system", resolved: "dark", setTheme: () => {} };
  return ctx;
}

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function resolve(t: ThemeChoice): "light" | "dark" {
  return t === "system" ? (systemDark() ? "dark" : "light") : t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  const apply = useCallback((t: ThemeChoice) => {
    const r = resolve(t);
    document.documentElement.setAttribute("data-theme", r);
    setResolved(r);
  }, []);

  // Hydrate from storage (the no-flash script already set the attribute).
  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as ThemeChoice) || "system";
    setThemeState(stored);
    apply(stored);
  }, [apply]);

  // Follow the OS while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, apply]);

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
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
