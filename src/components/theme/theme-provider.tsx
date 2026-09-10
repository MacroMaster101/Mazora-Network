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
    let stored: string | null = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch { /* Storage may be disabled. */ }
    const selected = stored === "light" || stored === "dark" ? stored : preferredTheme();
    setThemeState(selected);
    apply(selected);

    // Remove the old three-state value so future visits use the simpler behavior.
    if (stored === "system") {
      try { localStorage.removeItem(THEME_KEY); } catch { /* Theme still works for this visit. */ }
    }
  }, [apply]);

  const setTheme = useCallback(
    (t: ThemeChoice) => {
      try { localStorage.setItem(THEME_KEY, t); } catch { /* Theme still works for this visit. */ }
      setThemeState(t);
      apply(t);
    },
    [apply],
  );

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

/** Inline script that sets data-theme before first paint (no light/dark flash). */
export const themeNoFlashScript = `(function(){var theme='dark',t=null;try{t=localStorage.getItem('${THEME_KEY}');}catch(e){}theme=t==='light'||t!=='dark'&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',theme);var scene={'/':'home','/store':'store','/vote':'vote'}[location.pathname.replace(/\\/$/,'')||'/'];if(scene){var link=document.createElement('link');link.rel='preload';link.as='image';link.fetchPriority='high';link.href='/images/worlds/'+scene+'-hero-'+theme+(window.matchMedia('(max-width: 640px)').matches?'-mobile':'')+'.webp';document.head.appendChild(link);}})();`;
