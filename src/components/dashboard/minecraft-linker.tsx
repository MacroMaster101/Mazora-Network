"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui";

type State = "idle" | "awaiting" | "linked" | "expired";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `MZ-${code}`;
}

export function MinecraftLinker() {
  const { toast } = useToast();
  const [state, setState] = useState<State>("idle");
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state !== "awaiting") return;
    if (seconds <= 0) {
      setState("expired");
      return;
    }
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [state, seconds]);

  function generate() {
    setCode(makeCode());
    setSeconds(600);
    setState("awaiting");
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(`/link ${code}`);
      setCopied(true);
      toast("Command copied!", "success");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Couldn't copy.", "error");
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (state === "linked") {
    return (
      <div className="glass flex flex-col items-center px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent-bright">
          <Check size={26} />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold">Account linked</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted">Your Minecraft account is connected. Stats and rewards will sync automatically.</p>
        <button onClick={() => setState("idle")} className="btn btn-ghost btn-sm mt-5">
          Unlink (demo)
        </button>
      </div>
    );
  }

  return (
    <div className="glass p-6 sm:p-8">
      <ol className="space-y-5">
        <li className="flex gap-3">
          <Step n={1} done={state !== "idle"} />
          <div className="flex-1">
            <p className="font-semibold">Generate a verification code</p>
            <p className="text-sm text-muted">A one-time code, valid for 10 minutes.</p>
            {state === "idle" && (
              <button onClick={generate} className="btn btn-primary btn-sm mt-3">
                <Link2 size={15} /> Generate code
              </button>
            )}
            {(state === "awaiting" || state === "expired") && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="telemetry rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-xl font-bold tracking-widest text-accent-bright">
                  {code}
                </span>
                {state === "awaiting" ? (
                  <span className="telemetry text-sm text-muted">expires in {mm}:{ss}</span>
                ) : (
                  <button onClick={generate} className="btn btn-ghost btn-sm">
                    <RefreshCw size={14} /> New code
                  </button>
                )}
              </div>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <Step n={2} done={false} muted={state === "idle"} />
          <div className="flex-1">
            <p className="font-semibold">Run the command in-game</p>
            <p className="text-sm text-muted">Join the server and run this in chat:</p>
            {state !== "idle" && (
              <button
                onClick={copyCommand}
                className="telemetry mt-3 inline-flex items-center gap-2 rounded-lg border border-line-strong bg-ink/5 px-3 py-2 text-sm hover:border-accent/50"
              >
                /link {code}
                {copied ? <Check size={14} className="text-accent-bright" /> : <Copy size={14} className="text-muted" />}
              </button>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <Step n={3} done={false} muted={state === "idle"} />
          <div className="flex-1">
            <p className="font-semibold">Confirm the link</p>
            <p className="text-sm text-muted">Once the plugin verifies your code, your UUID links to this account.</p>
            {state === "awaiting" && (
              <button onClick={() => setState("linked")} className="btn btn-ghost btn-sm mt-3">
                I&apos;ve run the command
              </button>
            )}
          </div>
        </li>
      </ol>

      <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
        This is the linking flow UI. Real verification arrives when the Minecraft plugin posts confirmations to the link API
        (<span className="telemetry text-ink">/api/minecraft/link</span>). Codes are single-use and time-limited by design.
      </p>
    </div>
  );
}

function Step({ n, done, muted }: { n: number; done: boolean; muted?: boolean }) {
  return (
    <span
      className={`telemetry grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-sm font-bold ${
        done ? "border-accent/40 bg-accent/10 text-accent-bright" : muted ? "border-line text-muted" : "border-line-strong text-ink"
      }`}
    >
      {done ? <Check size={15} /> : n}
    </span>
  );
}
