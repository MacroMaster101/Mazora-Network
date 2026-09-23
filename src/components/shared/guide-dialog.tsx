"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { UNMOUNT_AFTER_MS as SPLASH_MS } from "@/components/shared/initial-site-loader";
import { CONSENT_EVENT, readConsent } from "@/lib/consent-client";
import { clearGuidePause, readGuidePause, writeGuidePause, type GuideKind } from "@/lib/guide-pause";
import { SITE_GUIDE_ACTIVE_ATTR, SITE_GUIDE_CLOSED_EVENT, clampStep } from "@/lib/site-guide";

/** Lets the cookie banner finish leaving before a guide appears. */
const AFTER_CONSENT_MS = 600;

export function guideStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/**
 * Open/close state shared by the member site guide and the staff guide.
 *
 * First-visit auto-open waits out the splash and any unanswered cookie banner,
 * so nobody is shown three things at once, and skips error screens. While
 * pending or open it sets SITE_GUIDE_ACTIVE_ATTR on <html> so the theme hint
 * holds back, and fires SITE_GUIDE_CLOSED_EVENT on close so it can take its
 * turn. Any way of closing counts as dismissed.
 *
 * A link inside the guide pauses it instead (see lib/guide-pause.ts): the slide
 * is remembered, a "Continue" pill replaces the dialog on every page, and
 * resuming reopens that slide. While paused it never auto-opens.
 */
export function useGuide({
  kind,
  username,
  stepCount,
  openEvent,
  shouldAutoOpen,
  onDismiss,
}: {
  kind: GuideKind;
  username: string;
  /** Slide count, so a remembered slide is clamped if the guide ever shrinks. */
  stepCount: number;
  openEvent: string;
  /** Read once after mount; true schedules the first-visit open. */
  shouldAutoOpen: () => boolean;
  /** Runs on every close — record "seen". */
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [openedBy, setOpenedBy] = useState<"auto" | "menu">("auto");
  /** Slide the guide was paused on, or null. Read after mount, so SSR never sees it. */
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Lets the auto-open timers bail if the guide was dismissed (e.g. opened and
  // closed from the account menu) while they were still pending.
  const dismissedRef = useRef(false);
  const shouldAutoOpenRef = useRef(shouldAutoOpen);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    shouldAutoOpenRef.current = shouldAutoOpen;
    onDismissRef.current = onDismiss;
  });

  const openAt = useCallback((by: "auto" | "menu", at: number) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    clearGuidePause(guideStorage(), kind, username);
    setPausedAt(null);
    setOpenedBy(by);
    setStep(at);
    setOpen(true);
  }, [kind, username]);

  const show = useCallback((by: "auto" | "menu") => openAt(by, 0), [openAt]);

  /** Hand the screen back: lets the theme hint take its turn. */
  const release = useCallback(() => {
    document.documentElement.removeAttribute(SITE_GUIDE_ACTIVE_ATTR);
    window.dispatchEvent(new Event(SITE_GUIDE_CLOSED_EVENT));
  }, []);

  /** For links inside the guide: leave the tour resumable instead of ending it. */
  const pause = useCallback(() => {
    dismissedRef.current = true;
    writeGuidePause(guideStorage(), kind, username, step);
    setPausedAt(step);
    setOpen(false);
    release();
  }, [kind, username, step, release]);

  /** The pill's Continue: reopen the slide it was paused on. */
  const resume = useCallback(() => openAt("menu", clampStep(pausedAt ?? 0, stepCount)), [openAt, pausedAt, stepCount]);

  const close = useCallback(() => {
    dismissedRef.current = true;
    clearGuidePause(guideStorage(), kind, username);
    setPausedAt(null);
    setOpen(false);
    onDismissRef.current();
    release();
    // The opener may be gone (e.g. the mobile drawer closed under the dialog),
    // so fall back to the page's main landmark instead of dropping focus.
    if (returnFocusRef.current?.isConnected) {
      returnFocusRef.current.focus();
    } else {
      document.getElementById("main")?.focus();
    }
  }, [kind, username, release]);

  useEffect(() => {
    // A paused tour shows its Continue pill instead of auto-opening again.
    const saved = readGuidePause(guideStorage(), kind, username);
    if (saved !== null) {
      setPausedAt(saved);
      return;
    }
    if (!shouldAutoOpenRef.current()) return;
    const root = document.documentElement;
    root.setAttribute(SITE_GUIDE_ACTIVE_ATTR, "pending");
    let consentTimer = 0;
    let stopWaitingForConsent = () => {};
    const blocked = () => dismissedRef.current || document.querySelector(".state-error") !== null;

    const splashTimer = window.setTimeout(() => {
      if (blocked()) return;
      if (readConsent() !== null) {
        show("auto");
        return;
      }
      const onConsent = () => {
        if (readConsent() === null) return;
        stopWaitingForConsent();
        consentTimer = window.setTimeout(() => {
          if (!blocked()) show("auto");
        }, AFTER_CONSENT_MS);
      };
      window.addEventListener(CONSENT_EVENT, onConsent);
      stopWaitingForConsent = () => window.removeEventListener(CONSENT_EVENT, onConsent);
    }, SPLASH_MS + 200);

    return () => {
      window.clearTimeout(splashTimer);
      window.clearTimeout(consentTimer);
      stopWaitingForConsent();
      root.removeAttribute(SITE_GUIDE_ACTIVE_ATTR);
    };
  }, [show, kind, username]);

  useEffect(() => {
    const onOpen = () => show("menu");
    window.addEventListener(openEvent, onOpen);
    return () => window.removeEventListener(openEvent, onOpen);
  }, [openEvent, show]);

  return { open, step, setStep, openedBy, close, pause, pausedAt, resume };
}

/**
 * The "Continue" pill a paused guide leaves on every page. Bottom-left for the
 * site guide (the discount alert owns bottom-right); bottom-right in /admin,
 * where the sidebar owns the left edge and the discount alert never shows.
 */
export function GuidePausePill({
  label,
  step,
  stepCount,
  side,
  onResume,
}: {
  label: string;
  step: number;
  stepCount: number;
  side: "left" | "right";
  onResume: () => void;
}) {
  const tipId = useId();
  const tip = `Continue ${label.toLowerCase()} · ${Math.min(step, stepCount - 1) + 1} of ${stepCount}`;
  return createPortal(
    // Full class names, not `guide-pill-${side}`: Tailwind keeps an @layer
    // components rule only when its class appears literally in the source.
    <div className={side === "left" ? "guide-pill guide-pill-left" : "guide-pill guide-pill-right"} role="region" aria-label={label}>
      {/* Icon only; the words live in the tooltip, which also shows briefly
          when the pill first appears so the icon explains itself. No end
          button: the tour ends from inside (Skip, Finish, ✕ on the last slide). */}
      <button type="button" className="guide-pill-resume" aria-label={tip} aria-describedby={tipId} onClick={onResume}>
        <Compass size={18} aria-hidden="true" />
      </button>
      <span id={tipId} role="tooltip" className="guide-pill-tip">{tip}</span>
    </div>,
    document.body,
  );
}

interface GuideDialogProps {
  open: boolean;
  /** Top-left label, e.g. "Site guide". */
  eyebrow: string;
  /** id of the slide's heading, which labels the dialog. */
  titleId: string;
  step: number;
  stepCount: number;
  onStepChange: (step: number) => void;
  /** Ends the tour: Skip, Finish, and ✕/Esc/outside on the last slide. */
  onClose: () => void;
  /** ✕/Esc/outside before the last slide: leave the tour resumable. */
  onPause?: () => void;
  children: ReactNode;
}

/**
 * The guide dialog: portal, backdrop, header, footer navigation, focus trap,
 * Esc to close, arrow keys between slides and scroll lock. A single-slide
 * guide shows no counter, dots or Skip — just Finish.
 *
 * Closing part-way (✕, Esc, a click outside) pauses when `onPause` is given, so
 * the tour can be picked up from the Continue pill; only Skip, Finish and
 * closing on the last slide end it.
 */
export function GuideDialog({ open, eyebrow, titleId, step, stepCount, onStepChange, onClose, onPause, children }: GuideDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismiss = onPause && step < stepCount - 1 ? onPause : onClose;

  // Focus and scroll lock: only on open, so navigating between slides never
  // pulls focus off the Next/Back button back onto the dialog wrapper.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        // Alt+Left/Right is browser back/forward; don't hijack it.
        if (event.altKey || event.metaKey || event.ctrlKey) return;
        onStepChange(clampStep(step + (event.key === "ArrowRight" ? 1 : -1), stepCount));
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismiss, onStepChange, step, stepCount]);

  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === stepCount - 1;
  const multi = stepCount > 1;

  return createPortal(
    <div className="site-guide-layer">
      <div className="site-guide-backdrop" onClick={dismiss} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="site-guide">
        <div className="site-guide-top">
          <span className="site-guide-eyebrow"><Compass size={13} aria-hidden="true" /> {eyebrow}</span>
          <span className="site-guide-count" aria-live="polite">{multi ? `${step + 1} of ${stepCount}` : ""}</span>
          <button type="button" className="site-guide-close" aria-label={`Close ${eyebrow.toLowerCase()}`} onClick={dismiss}>
            <X size={16} />
          </button>
        </div>
        <div className="site-guide-body">{children}</div>
        <div className="site-guide-foot">
          {!multi ? (
            <span />
          ) : isFirst ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Skip tour</button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onStepChange(clampStep(step - 1, stepCount))}>
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          )}
          <div className="site-guide-dots" aria-hidden="true">
            {multi && Array.from({ length: stepCount }, (_, i) => (
              <i key={i} className={i < step ? "is-done" : i === step ? "is-on" : undefined} />
            ))}
          </div>
          {isLast ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>Finish</button>
          ) : (
            <button
              type="button"
              className={`btn btn-sm ${isFirst ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onStepChange(clampStep(step + 1, stepCount))}
            >
              {isFirst ? "Start tour" : "Next"} <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
