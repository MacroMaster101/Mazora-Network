"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/ui";

/** Copies an absolute link to one comment. Falls back to a prompt where the clipboard API is unavailable. */
export function ShareButton({ href }: { href: string }) {
  const { toast } = useToast();

  async function share() {
    const url = new URL(href, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied", "success");
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button type="button" onClick={share} className="comment-action">
      <Share2 size={14} aria-hidden="true" /> Share
    </button>
  );
}
