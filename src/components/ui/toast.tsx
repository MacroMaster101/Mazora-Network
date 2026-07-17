"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "error";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastCtx {
  toast: (message: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) return { toast: () => {} };
  return ctx;
}

const icons = { success: CheckCircle2, info: Info, error: TriangleAlert };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          // Bottom-left keeps alerts clear of the right-side cart drawer.
          <div className="pointer-events-none fixed bottom-5 left-5 z-[300] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2">
            {toasts.map((t) => {
              const Icon = icons[t.tone];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "toast-card pointer-events-auto flex animate-fade-up items-start gap-3 rounded-2xl p-3.5",
                    `is-${t.tone}`,
                  )}
                  role="status"
                >
                  <span className="toast-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 pt-1 text-sm font-medium leading-snug">{t.message}</span>
                  <button
                    aria-label="Dismiss"
                    onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                    className="toast-dismiss mt-1 shrink-0 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
