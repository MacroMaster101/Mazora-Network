"use client";

import { useState } from "react";
import { Check, Link2, Twitter } from "lucide-react";
import { useToast } from "@/components/ui";

export function ShareButtons({ title }: { title: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast("Link copied!", "success");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy link.", "error");
    }
  }

  const tweet = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, "_blank");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Share</span>
      <button onClick={copyLink} className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong text-muted hover:text-ink" aria-label="Copy link">
        {copied ? <Check size={16} className="text-accent-bright" /> : <Link2 size={16} />}
      </button>
      <button onClick={tweet} className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong text-muted hover:text-ink" aria-label="Share on X">
        <Twitter size={16} />
      </button>
    </div>
  );
}
