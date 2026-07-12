"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Copies a server address to the clipboard with toast + inline confirmation.
 * `variant="inline"` renders a compact mono chip; default renders a button.
 */
export function CopyIpButton({
  ip,
  label,
  variant = "button",
  className,
}: {
  ip: string;
  label?: string;
  variant?: "button" | "inline";
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ip);
      setCopied(true);
      toast("Server IP copied!", "success");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy — select and copy manually.", "error");
    }
  }

  if (variant === "inline") {
    return (
      <button
        onClick={copy}
        className={cn(
          "telemetry group inline-flex items-center gap-2 rounded-lg border border-line-strong bg-ink/5 px-3 py-1.5 text-sm hover:border-accent/50",
          className,
        )}
        aria-label={`Copy ${ip}`}
      >
        <span>{ip}</span>
        {copied ? <Check size={14} className="text-accent-bright" /> : <Copy size={14} className="text-muted group-hover:text-ink" />}
      </button>
    );
  }

  return (
    <button onClick={copy} className={cn("btn btn-ghost", className)} aria-label={`Copy ${label ?? ip}`}>
      {copied ? <Check size={16} className="text-accent-bright" /> : <Copy size={16} />}
      {copied ? "Copied!" : label ?? "Copy IP"}
    </button>
  );
}
