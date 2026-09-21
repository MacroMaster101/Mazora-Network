"use client";

import { useState } from "react";
import { Check, Copy, Sparkles, Tag } from "lucide-react";
import { useToast } from "@/components/ui";

interface StoreDetailDiscountCalloutProps {
  code: string;
  percentOff: number;
  badge: string;
  savingsFormatted: string;
}

export function StoreDetailDiscountCallout({
  code,
  percentOff,
  badge,
  savingsFormatted,
}: StoreDetailDiscountCalloutProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast(`Code ${code} copied! (${percentOff}% off applied at checkout)`, "success");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast(`Discount code: ${code}`, "info");
    }
  };

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-violet-300/60 bg-violet-50/80 p-3.5 shadow-xs transition-colors dark:border-violet-500/30 dark:bg-violet-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-xs">
            <Tag size={15} aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-200/70 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-900 dark:bg-violet-500/25 dark:text-violet-200">
                <Sparkles size={10} aria-hidden="true" /> {badge}
              </span>
              <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300">
                {percentOff}% OFF Active
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              Save <strong className="font-extrabold text-violet-700 dark:text-violet-200">{savingsFormatted}</strong> on this item with code <strong className="font-mono font-black text-slate-900 dark:text-white">{code}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy promo code ${code}`}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
            copied
              ? "border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/25 dark:text-emerald-200"
              : "border border-violet-300 bg-white text-violet-950 shadow-xs hover:bg-violet-100 dark:border-violet-500/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          }`}
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} className="text-violet-600 dark:text-violet-200" aria-hidden="true" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
