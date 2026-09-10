"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Moon, Sun, SunMoon, X } from "lucide-react";
import { CONSENT_EVENT, readConsent } from "@/lib/consent-client";
import { UNMOUNT_AFTER_MS as SPLASH_MS } from "@/components/shared/initial-site-loader";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";
import {
  THEME_HINT_MENU_EVENT,
  markThemeHintSeen,
  shouldShowThemeHint,
  themeHintMessage,
  type ThemeHintVariant,
} from "./theme-hint";

/** Long enough to read, short enough not to linger over the header. */
const AUTO_DISMISS_MS = 12_000;
/** Lets the cookie banner finish leaving before the hint appears. */
const AFTER_CONSENT_MS = 600;

function hintStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/**
 * Wraps a theme control — the desktop orb, or the mobile menu button that leads
 * to the Theme row — and points a newcomer at it once, on their first visit.
 *
 * It waits out the opening splash and any unanswered cookie banner, so a new
 * visitor is never shown three things at once. Both header variants mount this;
 * only the one actually on screen reveals, and revealing records it as seen.
 */
export function ThemeHint({ variant, children }: { variant: ThemeHintVariant; children: ReactNode }) {
  const { resolved } = useTheme();
  const [visible, setVisible] = useState(false);
  const textId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const shownTheme = useRef<"light" | "dark" | null>(null);

  useEffect(() => {
    if (!shouldShowThemeHint(hintStorage())) return;
    let revealTimer = 0;
    let stopWaitingForConsent = () => {};

    const reveal = () => {
      // offsetParent is null inside the header variant hidden at this width.
      if (!anchorRef.current?.offsetParent) return;
      markThemeHintSeen(hintStorage());
      shownTheme.current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      setVisible(true);
    };

    const splashTimer = window.setTimeout(() => {
      if (readConsent() !== null) {
        reveal();
        return;
      }
      const onConsent = () => {
        if (readConsent() === null) return;
        stopWaitingForConsent();
        revealTimer = window.setTimeout(reveal, AFTER_CONSENT_MS);
      };
      window.addEventListener(CONSENT_EVENT, onConsent);
      stopWaitingForConsent = () => window.removeEventListener(CONSENT_EVENT, onConsent);
    }, SPLASH_MS + 200);

    return () => {
      window.clearTimeout(splashTimer);
      window.clearTimeout(revealTimer);
      stopWaitingForConsent();
    };
  }, []);

  // Switching theme is the thing the hint asks for, so it has done its job.
  useEffect(() => {
    if (visible && shownTheme.current && resolved !== shownTheme.current) setVisible(false);
  }, [resolved, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const control = anchorRef.current?.querySelector("button");
    control?.setAttribute("aria-describedby", textId);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      control?.removeAttribute("aria-describedby");
    };
  }, [visible, textId]);

  // Capture phase, so this runs before the wrapped control's own click handler.
  function onAnchorClick(event: MouseEvent) {
    if (!visible || bubbleRef.current?.contains(event.target as Node)) return;
    if (variant === "menu") window.dispatchEvent(new Event(THEME_HINT_MENU_EVENT));
    setVisible(false);
  }

  const Icon = variant === "menu" ? SunMoon : resolved === "dark" ? Sun : Moon;

  return (
    <span ref={anchorRef} className={cn("theme-hint-anchor", visible && "is-hinting")} data-variant={variant} onClickCapture={onAnchorClick}>
      {children}
      {visible && (
        <span ref={bubbleRef} className="theme-hint-bubble">
          <span className="theme-hint-icon" aria-hidden="true">
            <Icon size={15} />
          </span>
          <span id={textId} className="theme-hint-text">
            {themeHintMessage(variant, resolved)}
          </span>
          <button type="button" className="theme-hint-close" aria-label="Dismiss tip" onClick={() => setVisible(false)}>
            <X size={14} />
          </button>
        </span>
      )}
    </span>
  );
}
