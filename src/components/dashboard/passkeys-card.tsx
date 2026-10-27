"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Fingerprint, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { OwnerConfirmForm } from "@/components/account/owner-confirm";
import { FormRow, Input, Modal, useToast } from "@/components/ui";
import {
  deletePasskeyAction,
  finishPasskeyRegistrationAction,
  renamePasskeyAction,
  startPasskeyRegistrationAction,
} from "@/lib/actions/passkeys";
import { ownerConfirmationStatusAction } from "@/lib/actions/owner-confirmation";
import type { OwnerProof } from "@/lib/auth/owner-proof-kind";
import { createPasskeyCredential, passkeyErrorMessage, passkeysSupported } from "@/lib/passkeys/webauthn-json";
import type { PasskeySummary } from "@/lib/data/passkeys";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/events/local-time";

/** How "Add a passkey" confirms it is the account owner (lib/auth/owner-confirmation). */
export type PasskeyProof = OwnerProof;

const actionButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/50 hover:text-accent-bright disabled:opacity-50";

/**
 * The automatic name for a new passkey: the browser and device it was made on
 * ("Chrome on Windows"), which is how members tell passkeys apart in the list.
 * It can be renamed afterwards.
 */
function deviceName(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  if (browser && device) return `${browser} on ${device}`;
  return device ?? browser ?? "Passkey";
}

/**
 * Settings > Passkeys: sign in with a fingerprint, face or device PIN instead
 * of the password. A passkey replaces the password only; with two-step
 * verification on, the authenticator code is still asked for after it.
 */
export function PasskeysCard({ passkeys, proof }: { passkeys: PasskeySummary[] | null; proof: PasskeyProof }) {
  const router = useRouter();
  const { toast } = useToast();
  const [supported, setSupported] = useState(true);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<PasskeySummary | null>(null);
  const [removing, setRemoving] = useState<PasskeySummary | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setSupported(passkeysSupported()), []);

  if (passkeys === null) {
    return <p className="text-sm text-muted">Passkeys aren&apos;t available right now. Try again later.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="-mt-2 text-xs text-muted">
        Sign in with your fingerprint, face or device PIN instead of your password. Each passkey stays on the device or
        password manager that created it.
        {proof === "code" && " A passkey signs you in on its own, without your authenticator code."}
      </p>

      {/* One panel: the member's passkeys, then "Add a passkey" as its last row. */}
      <div className="divide-y divide-line-strong/60 overflow-hidden rounded-2xl border border-line-strong">
        {passkeys.map((passkey) => (
          <div key={passkey.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
              <Fingerprint size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-ink">{passkey.name}</strong>
              <span className="block text-xs text-muted">
                Added <RelativeTime iso={passkey.createdAt} />
                {passkey.lastUsedAt ? <>, last used <RelativeTime iso={passkey.lastUsedAt} /></> : ", not used to sign in yet"}
              </span>
            </span>
            <span className="flex gap-2">
              <button type="button" className={actionButton} onClick={() => setRenaming(passkey)} disabled={pending}>
                <Pencil size={13} aria-hidden="true" /> Rename
              </button>
              <button type="button" className={actionButton} onClick={() => setRemoving(passkey)} disabled={pending}>
                <Trash2 size={13} aria-hidden="true" /> Remove
              </button>
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!supported}
          className={cn(
            "group flex w-full items-center gap-3 px-4 py-3.5 text-left transition sm:px-5",
            supported ? "hover:bg-accent/[0.06] focus-visible:bg-accent/[0.08] focus-visible:outline-none" : "cursor-not-allowed",
          )}
        >
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-dashed transition",
              supported
                ? "border-accent/50 bg-accent/10 text-accent-bright group-hover:border-accent group-hover:bg-accent group-hover:text-white"
                : "border-line-strong text-muted",
            )}
          >
            <Plus size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className={cn("block text-sm", supported ? "text-ink group-hover:text-accent-bright" : "text-muted")}>
              {passkeys.length > 0 ? "Add another passkey" : "Add a passkey"}
            </strong>
            <span className="block text-xs text-muted">
              {supported
                ? passkeys.length > 0
                  ? "For another device, or a password manager you also use."
                  : "Use this device's fingerprint, face or PIN to sign in next time."
                : "This browser can't create passkeys. Try a current Chrome, Edge, Safari or Firefox."}
            </span>
          </span>
          {supported && (
            <ChevronRight size={18} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-bright" aria-hidden="true" />
          )}
        </button>
      </div>

      {adding && (
        <AddPasskeyDialog
          proof={proof}
          onClose={() => setAdding(false)}
          onAdded={(message) => {
            setAdding(false);
            toast(message, "success");
            router.refresh();
          }}
        />
      )}

      {renaming && (
        <RenameDialog
          passkey={renaming}
          onClose={() => setRenaming(null)}
          onDone={(message) => {
            setRenaming(null);
            toast(message, "success");
            router.refresh();
          }}
        />
      )}

      {removing && (
        <Modal open onClose={() => setRemoving(null)} label="Remove passkey" size="compact">
          <div className="panel space-y-4 p-6">
            <h2 className="font-display text-lg font-bold">Remove “{removing.name}”?</h2>
            <p className="text-sm text-muted">
              It will stop working for signing in here. You may also want to delete it from the device or password
              manager that holds it.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deletePasskeyAction({ passkeyId: removing.id });
                    toast(result.ok ? (result.message ?? "Passkey removed.") : result.message, result.ok ? "success" : "error");
                    if (result.ok) {
                      setRemoving(null);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Removing…" : "Remove passkey"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Two steps, like the big providers: "Confirm it's you" (skipped if done in the
 * last 15 minutes, for any account change), then "Create your passkey", which
 * opens the device prompt. No name is asked for; the passkey is named after the
 * device and can be renamed from the list.
 */
function AddPasskeyDialog({
  proof,
  onClose,
  onAdded,
}: {
  proof: PasskeyProof;
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const [step, setStep] = useState<"loading" | "confirm" | "create">("loading");
  const [needsConfirm, setNeedsConfirm] = useState(true);
  const [status, setStatus] = useState<"idle" | "device" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = status !== "idle";

  useEffect(() => {
    let active = true;
    void ownerConfirmationStatusAction().then((current) => {
      if (!active) return;
      const needed = current?.needed ?? true;
      setNeedsConfirm(needed);
      setStep(needed ? "confirm" : "create");
    });
    return () => {
      active = false;
    };
  }, []);

  const create = async () => {
    setError(null);
    setStatus("device");
    const started = await startPasskeyRegistrationAction();
    if (!started.ok) {
      setError(started.message);
      setStatus("idle");
      // The 15-minute confirmation ran out: go back and ask again.
      if (/Confirm it's you/.test(started.message)) {
        setNeedsConfirm(true);
        setStep("confirm");
      }
      return;
    }

    let credential: Record<string, unknown>;
    try {
      credential = await createPasskeyCredential(started.options);
    } catch (caught) {
      setError(passkeyErrorMessage(caught, "add"));
      setStatus("idle");
      return;
    }

    setStatus("saving");
    const saved = await finishPasskeyRegistrationAction({ challengeId: started.challengeId, credential, name: deviceName() });
    setStatus("idle");
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onAdded(saved.message ?? "Passkey added.");
  };

  const stepLabel = needsConfirm ? (step === "confirm" ? "Step 1 of 2" : "Step 2 of 2") : null;

  return (
    <Modal open onClose={busy ? () => undefined : onClose} label="Add a passkey" size="compact">
      <div className="panel space-y-4 p-6">
        <div>
          {stepLabel && <p className="text-xs font-semibold text-muted">{stepLabel}</p>}
          <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold">
            {step === "confirm" ? (
              <>
                <ShieldCheck size={19} className="text-accent-bright" aria-hidden="true" /> Confirm it&apos;s you
              </>
            ) : (
              <>
                <Fingerprint size={19} className="text-accent-bright" aria-hidden="true" /> Create your passkey
              </>
            )}
          </h2>
        </div>

        {step === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" /> One moment…
          </p>
        )}

        {step === "confirm" && (
          <OwnerConfirmForm
            proof={proof}
            onCancel={onClose}
            onConfirmed={() => {
              setError(null);
              setStep("create");
            }}
          />
        )}

        {step === "create" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Your device will ask for your PIN, fingerprint or face, then save the passkey to Windows Hello, iCloud
              Keychain, Google Password Manager or the password manager you use.
            </p>
            <p className="text-xs text-muted">
              Each device or password manager holds one passkey for your account. If this one already has it, add the
              next passkey from another device instead.
            </p>
            {status === "device" && <p className="text-xs font-semibold text-accent-bright">Follow the prompt from your device…</p>}
            {error && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void create()} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Fingerprint size={15} aria-hidden="true" />}
                {status === "device" ? "Waiting for device…" : status === "saving" ? "Saving…" : "Create passkey"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RenameDialog({
  passkey,
  onClose,
  onDone,
}: {
  passkey: PasskeySummary;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(passkey.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Modal open onClose={onClose} label="Rename passkey" size="compact">
      <form
        className="panel space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await renamePasskeyAction({ passkeyId: passkey.id, name });
            if (result.ok) onDone(result.message ?? "Passkey renamed.");
            else setError(result.message);
          });
        }}
      >
        <h2 className="font-display text-lg font-bold">Rename passkey</h2>
        <FormRow label="Name" htmlFor="passkey-rename">
          <Input id="passkey-rename" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
        </FormRow>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
