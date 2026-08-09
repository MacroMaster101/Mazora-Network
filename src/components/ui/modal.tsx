"use client";

import { useEffect, type ReactNode } from "react";
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
  size?: "compact" | "default" | "wide";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`animate-fade-up relative z-10 max-h-[90vh] w-full overflow-auto ${size === "wide" ? "max-w-6xl" : size === "compact" ? "max-w-md" : "max-w-3xl"}`}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-xl border border-accent/50 bg-base/95 text-ink shadow-lg transition hover:border-accent hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <X size={21} strokeWidth={2.6} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
