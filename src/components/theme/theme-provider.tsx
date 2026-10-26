"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { themeWorldAssets } from "./theme-worlds";

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
  const requestRef = useRef(0);
  const transitionRef = useRef<ViewTransition | null>(null);

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

  useEffect(() => () => {
    requestRef.current += 1;
    transitionRef.current?.skipTransition();
    document.documentElement.removeAttribute("data-theme-switching");
  }, []);

  const setTheme = useCallback(
    (t: ThemeChoice) => {
      try { localStorage.setItem(THEME_KEY, t); } catch { /* Theme still works for this visit. */ }
      setThemeState(t);
      const request = ++requestRef.current;
      transitionRef.current?.skipTransition();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const assets = themeWorldAssets(t, window.location.pathname, window.matchMedia("(max-width: 640px)").matches);
      // Decode destination art before capturing the next frame. Slow or failed
      // images must never trap the preference switch behind a network request.
      const images = Promise.all(assets.map(src => new Promise<void>(resolve => {
        const image = new Image();
        image.src = src;
        image.decode().then(() => resolve(), () => resolve());
      })));
      let timeout: ReturnType<typeof setTimeout>;
      const deadline = new Promise<void>(resolve => { timeout = setTimeout(resolve, 900); });
      void Promise.race([images, deadline]).then(async () => {
        clearTimeout(timeout);
        if (request !== requestRef.current) return;
        const root = document.documentElement;
        root.setAttribute("data-theme-switching", "");
        const commit = () => {
          if (request === requestRef.current) flushSync(() => apply(t));
        };
        try {
          if (!reducedMotion && typeof document.startViewTransition === "function") {
            const transition = document.startViewTransition(commit);
            transitionRef.current = transition;
            // A skipped snapshot can reject ready even though the update succeeds.
            void transition.ready.catch(() => {});
            await transition.finished;
          } else {
            commit();
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          }
        } finally {
          if (request === requestRef.current) {
            root.removeAttribute("data-theme-switching");
            transitionRef.current = null;
          }
        }
      }).catch(() => {
        if (request === requestRef.current) {
          apply(t);
          document.documentElement.removeAttribute("data-theme-switching");
        }
      });
    },
    [apply],
  );

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

/** Inline script that sets data-theme before first paint (no light/dark flash). */
export const themeNoFlashScript = `(function(){var theme='dark',t=null;try{t=localStorage.getItem('${THEME_KEY}');}catch(e){}theme=t==='light'||t!=='dark'&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',theme);var scene={'/':'home','/store':'store','/vote':'vote'}[location.pathname.replace(/\\/$/,'')||'/'];if(scene){var link=document.createElement('link');link.rel='preload';link.as='image';link.fetchPriority='high';link.href='/images/worlds/'+scene+'-hero-'+theme+(window.matchMedia('(max-width: 640px)').matches?'-mobile':'')+(theme==='light'?'-v3':'')+'.webp';document.head.appendChild(link);}})();`;
