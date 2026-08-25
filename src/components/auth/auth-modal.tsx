"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { CircleCheck, Server, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeCycleButton } from "@/components/theme/theme-toggle";
import { site } from "@/lib/site";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function AuthModal({
  children,
  label,
  onClose,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        ".auth-modal-scroll input:not([type='hidden']), .auth-modal-scroll button, .auth-modal-scroll a[href]",
      );
      (first ?? dialogRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="auth-modal-layer">
      <button type="button" className="auth-modal-backdrop" onClick={close} aria-label="Close account dialog" />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="auth-modal-shell"
      >
        <aside className="auth-modal-world">
          <Logo height={82} className="auth-modal-logo" />
          <div>
            <p className="auth-world-kicker"><span /> Mazora access</p>
            <h2>Your world is waiting.</h2>
            <p>Continue your progress, events, forums, and community identity from one secure account.</p>
            <div className="auth-world-features" aria-label="Account benefits">
              <span><CircleCheck size={13} /> One identity</span>
              <span><CircleCheck size={13} /> Synced progress</span>
              <span><CircleCheck size={13} /> Player support</span>
            </div>
          </div>
          <div className="auth-modal-trust">
            <ShieldCheck size={16} /> Secure player portal
            <span><i /> {site.javaIp}</span>
          </div>
        </aside>

        <div className="auth-modal-form-side">
          <header className="auth-modal-toolbar">
            <Logo height={52} className="auth-modal-mobile-logo" />
            <p><Server size={14} /> Player portal</p>
            <div>
              <ThemeCycleButton className="auth-theme-toggle" />
              <button type="button" onClick={close} className="auth-modal-close" aria-label="Close account dialog">
                <X size={18} />
              </button>
            </div>
          </header>
          <div className="auth-modal-scroll">
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
