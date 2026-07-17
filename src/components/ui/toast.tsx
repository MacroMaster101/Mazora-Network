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
const tones: Record<ToastTone, string> = {
  success: "text-accent-bright",
  info: "text-ink",
  error: "text-danger",
};

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
          <div className="pointer-events-none fixed bottom-5 right-5 z-[300] flex flex-col gap-2">
            {toasts.map((t) => {
              const Icon = icons[t.tone];
              return (
                <div
                  key={t.id}
                  className="pointer-events-auto flex animate-fade-up items-center gap-3 rounded-xl border border-line-strong bg-card/95 px-4 py-3 shadow-2xl backdrop-blur"
                  role="status"
                >
                  <Icon size={18} className={cn(tones[t.tone])} />
                  <span className="text-sm font-medium">{t.message}</span>
                  <button
                    aria-label="Dismiss"
                    onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                    className="ml-1 text-muted hover:text-ink"
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
