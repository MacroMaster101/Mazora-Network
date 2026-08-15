"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Accessible modal dialog. Closes on Escape and backdrop click. */
export function Modal({
  open,
  onClose,
  children,
  label,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
  size?: "compact" | "default" | "editor" | "wide";
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /*
    `onClose` used to be a dependency of the effect below, and every one of the
    eighteen call sites passes an inline arrow — so its identity changed on
    every render of the parent. Typing one character into a field inside a modal
    re-rendered the parent, which tore the effect down (restoring focus to
    whatever was focused before the modal opened) and set it up again (focusing
    the first focusable element in the frame). The caret was yanked out of the
    input after each keystroke, which is what made every modal form in the admin
    impossible to type in continuously.

    The handler is read through a ref so the effect can depend on `open` alone
    and run exactly once per open/close, while still calling the latest closure.
  */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab") return;
      const frame = frameRef.current;
      if (!frame) return;
      const focusable = Array.from(
        frame.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        e.preventDefault();
        frame.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const first = frameRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? frameRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={frameRef}
        role="dialog"
        aria-modal="true"
        aria-label={label || "Dialog"}
        tabIndex={-1}
        className={`modal-frame animate-fade-up relative z-10 w-full ${size === "wide" ? "max-w-6xl" : size === "editor" ? "max-w-4xl" : size === "compact" ? "max-w-md" : "max-w-3xl"}`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-xl border border-accent/50 bg-page/95 text-ink shadow-lg transition hover:border-accent hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <X size={21} strokeWidth={2.6} />
        </button>
        <div className="modal-scroll-shell max-h-[90vh] w-full overflow-x-hidden overflow-y-auto rounded-[1.5rem]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
