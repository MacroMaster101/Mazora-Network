"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/ui/app-link";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Minus, Sparkles, Tag, X } from "lucide-react";
import type { PublicDiscountAlert } from "@/lib/store-discount";
import { useToast } from "@/components/ui";
import { CONSENT_EVENT, readConsent } from "@/lib/consent-client";
import { EligibleItemsModal } from "./eligible-items-modal";

interface FloatingDiscountAlertProps {
  alerts?: PublicDiscountAlert[] | null;
  alert?: PublicDiscountAlert | null;
}

export function FloatingDiscountAlert({ alerts, alert }: FloatingDiscountAlertProps) {
  const pathname = usePathname();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEligibleModal, setShowEligibleModal] = useState(false);
  const [consentAnswered, setConsentAnswered] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [, startTransition] = useTransition();

  const activeAlerts = alerts && alerts.length > 0 ? alerts : alert ? [alert] : [];
  const safeIndex = activeAlerts.length > 0 ? currentIndex % activeAlerts.length : 0;
  const currentAlert = activeAlerts[safeIndex];

  // Listen to cookie consent: only show discount alert once user has accepted or declined cookies
  useEffect(() => {
    if (activeAlerts.length === 0) return;
    const syncConsent = () => {
      setConsentAnswered(readConsent() !== null);
    };
    syncConsent();
    window.addEventListener(CONSENT_EVENT, syncConsent);
    return () => window.removeEventListener(CONSENT_EVENT, syncConsent);
  }, [activeAlerts.length]);

  // Read stored dismissal/minimized preferences on mount
  useEffect(() => {
    if (!currentAlert) return;
    try {
      const dismissKey = `mazora_alert_dismissed_${currentAlert.code}`;
      const isDismissed = sessionStorage.getItem(dismissKey) === "true";
      if (isDismissed) {
        setDismissed(true);
        return;
      }
      const isMin = sessionStorage.getItem("mazora_alert_minimized") === "true";
      if (isMin) {
        setMinimized(true);
      }
    } catch {
      // Storage access blocked / private mode
    }
  }, [currentAlert]);

  // Gentle delay for entrance animation once consent has been answered
  useEffect(() => {
    if (activeAlerts.length === 0 || !consentAnswered || dismissed) {
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => setMounted(true), 600);
    return () => clearTimeout(timer);
  }, [activeAlerts.length, consentAnswered, dismissed]);

  // Auto-switch carousel slides every 6.5s (pauses on hover or when minimized)
  useEffect(() => {
    if (activeAlerts.length <= 1 || isPaused || minimized || !mounted) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeAlerts.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [activeAlerts.length, isPaused, minimized, mounted]);

  if (activeAlerts.length === 0 || !currentAlert || dismissed || !consentAnswered) return null;

  // Never render on admin control room routes
  if (pathname?.startsWith("/admin")) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`mazora_alert_dismissed_${currentAlert.code}`, "true");
    } catch {
      // Storage access blocked
    }
  };

  const handleToggleMinimize = () => {
    const next = !minimized;
    setMinimized(next);
    try {
      sessionStorage.setItem("mazora_alert_minimized", next ? "true" : "false");
    } catch {
      // Storage access blocked
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeAlerts.length) % activeAlerts.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeAlerts.length);
  };

  const handleCopyCode = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentAlert.code);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = currentAlert.code;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      startTransition(() => setCopied(true));
      toast(`Code ${currentAlert.code} copied! (${currentAlert.percentOff}% off in store)`, "success");
      setTimeout(() => setCopied(false), 2400);
    } catch {
      toast(`Copy code: ${currentAlert.code}`, "info");
    }
  };

  const cornerClass = "right-4 sm:right-6 bottom-4 sm:bottom-6";

  // Calculate days remaining if expiresAt is provided
  let expiresLabel: string | null = null;
  if (currentAlert.expiresAt) {
    const end = new Date(currentAlert.expiresAt).getTime();
    const diffDays = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= 7) {
      expiresLabel = diffDays === 1 ? "Ends in 24 hours" : `Ends in ${diffDays} days`;
    }
  }

  // Collapsed Pill View
  if (minimized) {
    return (
      <aside
        aria-label="Active discount promotion"
        className={`fixed z-[85] transition-all duration-500 ease-out ${cornerClass} ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={handleToggleMinimize}
          className="group relative flex items-center gap-2.5 rounded-full border border-violet-200/90 bg-white/95 py-2 pl-3.5 pr-3.5 shadow-[0_6px_25px_rgba(35,21,53,0.12)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400 hover:scale-[1.03] hover:shadow-[0_8px_30px_rgba(124,58,237,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-violet-500/40 dark:bg-[#181126]/95 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_25px_rgba(124,58,237,0.2)] dark:hover:border-violet-400"
          aria-label="Expand discount promotion alert"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400" />
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
            <Tag size={13} className="text-violet-600 dark:text-violet-300" aria-hidden="true" />
            <span>{currentAlert.percentOff}% OFF</span>
            <span className="font-mono font-extrabold text-violet-700 dark:text-violet-300">{currentAlert.code}</span>
            {activeAlerts.length > 1 && (
              <span className="rounded-full bg-violet-100 px-1.5 py-0.2 text-[9px] font-extrabold text-violet-700 dark:bg-white/15 dark:text-violet-200">
                +{activeAlerts.length - 1} more
              </span>
            )}
          </span>
          <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs transition-colors group-hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500">
            Open
          </span>
        </button>
      </aside>
    );
  }

  // Full Floating Cloud Promo Card
  return (
    <>
      <aside
        aria-label="Discount promotion alert"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={() => setIsPaused(false)}
        className={`fixed z-[85] max-w-[340px] sm:max-w-[370px] transition-all duration-500 ease-out ${cornerClass} ${
          mounted ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95"
        }`}
      >
        <div className="relative overflow-hidden rounded-3xl border border-violet-200/90 bg-white/95 p-4 sm:p-5 shadow-[0_16px_45px_-10px_rgba(35,21,53,0.16),0_4px_25px_-5px_rgba(124,58,237,0.12)] backdrop-blur-2xl dark:border-violet-500/40 dark:bg-[#181126]/95 dark:shadow-[0_16px_50px_-10px_rgba(0,0,0,0.7),0_0_40px_-5px_rgba(139,92,246,0.3)]">
          {/* Soft background ambient glow */}
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl dark:bg-violet-500/25"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-accent/15 blur-2xl dark:bg-accent/25"
            aria-hidden="true"
          />

          {/* Top Header Row with Pager Controls if multi-alert */}
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-100/70 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-200 truncate">
                <Sparkles size={11} className="shrink-0 text-amber-500 dark:text-amber-300" aria-hidden="true" />
                <span className="truncate">{currentAlert.badge}</span>
              </span>

              {activeAlerts.length > 1 && (
                <span className="rounded-full bg-violet-200/70 px-1.5 py-0.2 text-[9px] font-black text-violet-800 dark:bg-white/10 dark:text-violet-200">
                  {safeIndex + 1}/{activeAlerts.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {activeAlerts.length > 1 && (
                <div className="flex items-center gap-0.5 mr-1 border-r border-violet-200 dark:border-white/10 pr-1.5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    aria-label="Previous promotion deal"
                    title="Previous deal"
                  >
                    <ChevronLeft size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    aria-label="Next promotion deal"
                    title="Next deal"
                  >
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleMinimize}
                className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                aria-label="Minimize discount alert to floating pill"
                title="Minimize"
              >
                <Minus size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                aria-label="Dismiss discount alert"
                title="Dismiss"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Promo Headline & Expiry */}
          <div className="relative mt-2.5">
            <p className="text-sm font-extrabold leading-snug text-slate-900 dark:text-white transition-opacity duration-200">
              {currentAlert.headline}
            </p>
            {expiresLabel && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                {expiresLabel}
              </p>
            )}

            {/* Slide dots if multiple alerts */}
            {activeAlerts.length > 1 && (
              <div className="mt-2 flex items-center gap-1">
                {activeAlerts.map((item, idx) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      idx === safeIndex
                        ? "w-4 bg-violet-600 dark:bg-violet-400"
                        : "w-1.5 bg-violet-200 dark:bg-white/20 hover:bg-violet-300"
                    }`}
                    aria-label={`Go to promotion ${idx + 1}: ${item.code}`}
                    title={`${item.percentOff}% off with code ${item.code}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Eligibility bar & View items modal trigger */}
          <div className="relative mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-violet-200/70 bg-violet-100/50 px-2.5 py-1.5 dark:border-violet-500/30 dark:bg-white/5">
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-violet-800 dark:text-violet-200">
              <Tag size={12} className="shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
              <span className="truncate">
                {currentAlert.isAllProducts
                  ? "Applies to: All Store Items"
                  : `Applies to: ${currentAlert.eligibleProducts?.length ?? currentAlert.productIds.length} Eligible Items`}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowEligibleModal(true);
              }}
              className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-[10px] font-extrabold text-violet-700 shadow-xs transition hover:bg-violet-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              View items
            </button>
          </div>

          {/* Code Chip & Copy Action */}
          <div className="relative mt-3 flex items-center justify-between gap-2 rounded-2xl border border-violet-200/80 bg-violet-50/70 p-2 sm:p-2.5 dark:border-violet-500/30 dark:bg-white/5">
            <div className="min-w-0 pl-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                Discount Code
              </span>
              <span className="telemetry block truncate text-sm font-mono font-black text-violet-700 dark:text-violet-200">
                {currentAlert.code}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                copied
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-200 dark:border-emerald-500/40"
                  : "border border-violet-200 bg-white hover:border-violet-400 hover:bg-violet-50/80 text-violet-950 shadow-xs dark:border-violet-500/40 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white"
              }`}
              aria-label={`Copy discount code ${currentAlert.code}`}
            >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} className="text-violet-600 dark:text-violet-200" aria-hidden="true" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Storefront Link CTA */}
          <div className="relative mt-3 flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Save {currentAlert.percentOff}% at checkout
            </span>
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition-all dark:bg-violet-600 dark:hover:bg-violet-500 dark:shadow-violet-500/40 active:scale-95"
            >
              <span>Shop Store</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Eligible Items Popup Modal */}
      {showEligibleModal && (
        <EligibleItemsModal
          alert={currentAlert}
          alerts={activeAlerts}
          isOpen={showEligibleModal}
          onClose={() => setShowEligibleModal(false)}
        />
      )}
    </>
  );
}
