"use client";

import { useState, useTransition } from "react";
import { DatabaseBackup, Loader } from "lucide-react";
import { runBackupNow, type BackupActionResult } from "@/lib/actions/backup";

/**
 * "Run backup now" on the backup card. Two steps, so a stray click starts
 * nothing: the first asks, the second starts the run. The answer is shown in
 * place; the card's own status catches up on the next page load.
 */
export function BackupRunButton({ disabled }: { disabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<BackupActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      setResult(await runBackupNow());
      setConfirming(false);
    });
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink">Start a full backup to Cloudflare R2 now?</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={start} disabled={pending}>
            {pending ? <Loader size={14} className="animate-spin" aria-hidden="true" /> : null}
            {pending ? "Starting…" : "Start backup"}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setResult(null);
            setConfirming(true);
          }}
          disabled={disabled}
          title={disabled ? "A backup is already running." : undefined}
        >
          <DatabaseBackup size={14} aria-hidden="true" /> Run backup now
        </button>
      )}
      {result && (
        <p role="status" className={`text-[13px] ${result.ok ? "text-success" : "text-warning"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
