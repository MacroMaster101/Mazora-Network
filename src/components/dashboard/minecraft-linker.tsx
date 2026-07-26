"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import {
  cancelMinecraftLinkCodeAction,
  generateMinecraftLinkCodeAction,
  getMinecraftLinkStatusAction,
  type MinecraftLinkActionState,
} from "@/lib/actions/minecraft";
import { disconnectMinecraftAction, type AccountActionResult } from "@/lib/actions/account";
import { MinecraftAvatar, MinecraftMark } from "@/components/shared";
import { Modal, useToast } from "@/components/ui";

const emptyAccountState: AccountActionResult = { ok: false };

export function MinecraftLinker({
  initialStatus,
  serverAddress,
}: {
  initialStatus: MinecraftLinkActionState;
  serverAddress: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(initialStatus.pendingExpiresAt ?? null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [generateState, generateAction, generatePending] = useActionState(generateMinecraftLinkCodeAction, initialStatus);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelMinecraftLinkCodeAction, initialStatus);
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(disconnectMinecraftAction, emptyAccountState);
  const { toast } = useToast();
  const router = useRouter();

  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  const seconds = Math.max(0, Math.ceil((expiryMs - now) / 1000));
  const expired = Boolean(expiresAt) && seconds === 0;
  const minutesText = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!expiresAt || status.linked) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, status.linked]);

  useEffect(() => {
    if (!generateState.message) return;
    toast(generateState.message, generateState.ok ? "success" : "error");
    setStatus(generateState);
    if (generateState.code && generateState.expiresAt) {
      setCode(generateState.code);
      setExpiresAt(generateState.expiresAt);
      setNow(Date.now());
    }
    if (generateState.linked) setCode(null);
  }, [generateState, toast]);

  useEffect(() => {
    if (!cancelState.message) return;
    toast(cancelState.message, cancelState.ok ? "success" : "error");
    if (cancelState.ok) {
      setCode(null);
      setExpiresAt(null);
      setStatus(cancelState);
    }
  }, [cancelState, toast]);

  useEffect(() => {
    if (!disconnectState.message) return;
    toast(disconnectState.message, disconnectState.ok ? "success" : "error");
    if (disconnectState.ok) {
      setConfirmDisconnect(false);
      setCode(null);
      setExpiresAt(null);
      setStatus({ ok: true, enabled: initialStatus.enabled });
      router.refresh();
    }
  }, [disconnectState, initialStatus.enabled, router, toast]);

  useEffect(() => {
    if (status.linked || !expiresAt || expired) return;
    let active = true;
    const poll = async () => {
      const next = await getMinecraftLinkStatusAction();
      if (!active) return;
      if (next.linked) {
        setStatus(next);
        setCode(null);
        setExpiresAt(null);
        toast(`${next.linked.username} is now connected.`, "success");
        router.refresh();
      }
    };
    const id = window.setInterval(() => void poll(), 2500);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [expired, expiresAt, router, status.linked, toast]);

  async function checkStatus() {
    setChecking(true);
    const next = await getMinecraftLinkStatusAction();
    setChecking(false);
    setStatus(next);
    if (next.linked) {
      setCode(null);
      setExpiresAt(null);
      toast(`${next.linked.username} is connected.`, "success");
      router.refresh();
    } else {
      toast(expired ? "That code has expired. Generate a new one." : "Still waiting for the in-game command.", "info");
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast(`${label} copied.`, "success");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Could not copy to the clipboard.", "error");
    }
  }

  const compactUuid = useMemo(() => {
    const uuid = status.linked?.uuid ?? "";
    return uuid ? `${uuid.slice(0, 8)}…${uuid.slice(-6)}` : "";
  }, [status.linked?.uuid]);

  if (status.linked) {
    return (
      <>
        <section className="minecraft-linked-card panel">
          <div className="minecraft-linked-main">
            <MinecraftAvatar username={status.linked.username} size={84} rounded="rounded-2xl" />
            <div className="min-w-0 flex-1">
              <span className="minecraft-status-chip is-connected"><CheckCircle2 size={13} /> Connected</span>
              <h2 className="mt-3 truncate font-display text-2xl font-extrabold">{status.linked.username}</h2>
              <p className="mt-1 text-sm text-muted">UUID {compactUuid}</p>
              <p className="mt-1 text-xs text-muted">Linked {new Date(status.linked.linkedAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="minecraft-linked-actions">
            <Link href="/dashboard/settings" className="btn btn-secondary btn-sm"><MinecraftMark className="h-4 w-4" /> Use skin as profile photo</Link>
            <button type="button" className="btn btn-ghost btn-sm border-danger/30 text-danger" onClick={() => setConfirmDisconnect(true)}>
              <Unlink size={14} /> Disconnect
            </button>
          </div>
          <div className="minecraft-sync-note"><ShieldCheck size={16} /> Your stats, voting rewards, and purchases can now sync to this UUID.</div>
        </section>

        <Modal open={confirmDisconnect} onClose={() => setConfirmDisconnect(false)} label="Disconnect Minecraft account">
          <div className="panel mx-auto max-w-md border-danger/30 p-6 sm:p-7">
            <h2 className="font-display text-xl font-bold">Disconnect Minecraft?</h2>
            <p className="mt-2 text-sm text-muted">This removes the Minecraft identity and its synced statistics. You can link it again later.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDisconnect(false)} disabled={disconnectPending}>Cancel</button>
              <button
                type="button"
                className="btn btn-ghost btn-sm border-danger/40 bg-danger/10 text-danger"
                onClick={() => startTransition(() => disconnectAction())}
                disabled={disconnectPending}
              >
                {disconnectPending ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                {disconnectPending ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <section className="minecraft-link-card panel">
      <div className="minecraft-link-heading">
        <div>
          <span className={`minecraft-status-chip ${expiresAt && !expired ? "is-waiting" : ""}`}>
            {expiresAt && !expired ? <Clock3 size={13} /> : <Link2 size={13} />}
            {expiresAt && !expired ? "Waiting for game" : "Not connected"}
          </span>
          <h2 className="mt-3 font-display text-2xl font-extrabold">Connect your player</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">Securely prove ownership from inside the Mazora Minecraft server. No Microsoft password is requested or stored.</p>
        </div>
        <span className="minecraft-link-shield" aria-hidden="true"><MinecraftMark className="h-8 w-8" /></span>
      </div>

      {!status.enabled && (
        <div className="minecraft-config-warning" role="status">
          <Server size={17} />
          <div><strong>Linking service is not configured</strong><span>Add the server-only plugin secret and apply migration 004 before generating codes.</span></div>
        </div>
      )}

      <ol className="minecraft-link-steps">
        <li className={code || expiresAt ? "is-active" : ""}>
          <Step n={1} done={Boolean(code && !expired)} />
          <div>
            <strong>Generate a one-time code</strong>
            <span>It expires after 10 minutes and works once.</span>
          </div>
        </li>
        <li className={code && !expired ? "is-active" : ""}>
          <Step n={2} done={false} />
          <div>
            <strong>Join {serverAddress}</strong>
            <span>Run the command below in Minecraft chat.</span>
          </div>
        </li>
        <li>
          <Step n={3} done={false} />
          <div>
            <strong>Automatic verification</strong>
            <span>This page updates as soon as the server confirms your UUID.</span>
          </div>
        </li>
      </ol>

      {code && !expired ? (
        <div className="minecraft-command-panel">
          <div className="minecraft-command-topline">
            <span>In-game command</span>
            <span className="telemetry"><Clock3 size={12} /> {minutesText}</span>
          </div>
          <button type="button" className="minecraft-command" onClick={() => copy(`/link ${code}`, "Command")}>
            <span>/link {code}</span>
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <p>Keep this code private. Anyone who can run it in-game can connect that Minecraft UUID to your website account.</p>
        </div>
      ) : expiresAt && !code && !expired ? (
        <div className="minecraft-pending-hidden">
          <Clock3 size={18} />
          <div><strong>A verification code is already active</strong><span>For security it cannot be displayed again after a reload. Generate a replacement if you no longer have it.</span></div>
        </div>
      ) : expired ? (
        <div className="minecraft-pending-hidden is-expired">
          <Clock3 size={18} />
          <div><strong>Verification code expired</strong><span>Generate a fresh code and run the new command in-game.</span></div>
        </div>
      ) : null}

      <div className="minecraft-link-actions">
        <form action={generateAction}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!status.enabled || generatePending || cancelPending}>
            {generatePending ? <Loader2 size={14} className="animate-spin" /> : expiresAt ? <RefreshCw size={14} /> : <Link2 size={14} />}
            {generatePending ? "Generating…" : expiresAt ? "Generate replacement" : "Generate code"}
          </button>
        </form>
        {(code || expiresAt) && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={checkStatus} disabled={checking || expired}>
            {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {checking ? "Checking…" : "Check connection"}
          </button>
        )}
        {expiresAt && (
          <form action={cancelAction}>
            <button type="submit" className="btn btn-ghost btn-sm" disabled={cancelPending || generatePending}>
              {cancelPending ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
              {cancelPending ? "Cancelling…" : "Cancel code"}
            </button>
          </form>
        )}
        <button type="button" className="minecraft-server-copy" onClick={() => copy(serverAddress, "Server address")}>
          <Server size={14} /> {serverAddress} <Copy size={12} />
        </button>
      </div>
    </section>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`minecraft-step-number${done ? " is-done" : ""}`} aria-label={`Step ${n}`}>
      {done ? <Check size={17} /> : n}
    </span>
  );
}