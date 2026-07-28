"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useToast } from "@/components/ui";

export function ShareButtons() {
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

  return (
    <div className="news-article-share">
      <span>Share this story</span>
      <button type="button" onClick={copyLink} className="news-article-copy-link" aria-label="Copy link">
        {copied ? <Check size={16} className="text-accent-bright" /> : <Link2 size={16} />}
        <span>{copied ? "Copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
