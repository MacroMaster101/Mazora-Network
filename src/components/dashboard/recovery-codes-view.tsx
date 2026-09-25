"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

/**
 * Freshly issued recovery codes. They are shown this once — only their hashes
 * are stored — so copying and downloading are offered side by side.
 */
export function RecoveryCodesView({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const body = [
      "Mazora Network — two-step verification recovery codes",
      "",
      "Each code works once. Keep them somewhere safe and private.",
      "",
      ...codes,
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mazora-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 rounded-2xl border border-line-strong bg-ink/5 p-4 font-mono text-sm tracking-wider text-ink">
        {codes.map((code, index) => (
          <li key={code} className="flex items-center gap-2 rounded-lg bg-page/40 px-3 py-2">
            <span className="w-5 text-right text-[10px] text-muted" aria-hidden="true">
              {index + 1}
            </span>
            <span className="select-all">{code}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn btn-ghost btn-sm">
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy codes"}
        </button>
        <button type="button" onClick={download} className="btn btn-ghost btn-sm">
          <Download size={15} />
          Download .txt
        </button>
      </div>
    </div>
  );
}
