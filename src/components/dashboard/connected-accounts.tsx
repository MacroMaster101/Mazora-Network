"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, Gamepad2, Link2Off, Loader2, LogIn, RefreshCw, Unlink } from "lucide-react";
import {
  oauthAction,
  switchDiscordAction,
  unlinkDiscordAction,
  type AuthResult,
} from "@/lib/actions/auth";
import { disconnectMinecraftAction, type AccountActionResult } from "@/lib/actions/account";
import type { DiscordIdentity } from "@/lib/types";
import { DiscordIcon, GoogleIcon } from "@/components/auth/provider-icons";
import { MinecraftMark } from "@/components/shared/minecraft-mark";
import { Modal, useToast } from "@/components/ui";

const initialAuth: AuthResult = { ok: false };
const initialAccount: AccountActionResult = { ok: false };

interface MinecraftIdentity {
  username: string;
  uuid: string;
  linkedAt: string;
}

interface ConnectedAccountsProps {
  email: string;
  hasGoogle: boolean;
  initialDiscord: DiscordIdentity | null;
  initialMinecraft: MinecraftIdentity | null;
}

type MinecraftDialog = "switch" | "disconnect" | null;

export function ConnectedAccounts({ email, hasGoogle, initialDiscord, initialMinecraft }: ConnectedAccountsProps) {
  const [discord, setDiscord] = useState<DiscordIdentity | null>(initialDiscord);
  const [, setMinecraft] = useState<MinecraftIdentity | null>(initialMinecraft);
  const [minecraftDialog, setMinecraftDialog] = useState<MinecraftDialog>(null);
  const [oauthState, oauthFormAction, oauthPending] = useActionState(oauthAction, initialAuth);
  const [unlinkState, unlinkFormAction, unlinkPending] = useActionState(unlinkDiscordAction, initialAuth);
  const [switchState, switchFormAction, switchPending] = useActionState(switchDiscordAction, initialAuth);
  const [minecraftState, minecraftDisconnectAction, minecraftPending] = useActionState(
    disconnectMinecraftAction,
    initialAccount,
  );
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  // This card renders in both the member area (/dashboard/settings) and the
  // staff area (/admin/account). OAuth round-trips must return to whichever
  // one the user actually started from — staff are redirected out of /dashboard.
  const returnPath = pathname.startsWith("/admin") ? "/admin/account" : "/dashboard/settings";

  useEffect(() => {
    if (!oauthState.ok && oauthState.message) toast(oauthState.message, "error");
  }, [oauthState, toast]);

  useEffect(() => {
    if (!unlinkState.message) return;
    toast(unlinkState.message, unlinkState.ok ? "success" : "error");
    if (unlinkState.ok) setDiscord(null);
  }, [unlinkState, toast]);

  useEffect(() => {
    if (!switchState.ok && switchState.message) toast(switchState.message, "error");
  }, [switchState, toast]);

  useEffect(() => {
    if (!minecraftState.message) return;
    toast(minecraftState.message, minecraftState.ok ? "success" : "error");
    if (minecraftState.ok) {
      const wasSwitching = minecraftDialog === "switch";
      setMinecraft(null);
      setMinecraftDialog(null);
      if (wasSwitching) router.push(pathname.startsWith("/admin") ? returnPath : "/dashboard/minecraft");
      else router.refresh();
    }
  }, [minecraftDialog, minecraftState, pathname, returnPath, router, toast]);

  const connectDiscord = () => {
    const formData = new FormData();
    formData.append("provider", "discord");
    formData.append("next", returnPath);
    startTransition(() => oauthFormAction(formData));
  };

  const discordBusy = oauthPending || unlinkPending || switchPending;

  return (
    <div className="space-y-3">
      <div className="connected-account-row flex items-center gap-3 rounded-xl border border-line-strong bg-ink/5 px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
          <GoogleIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-1.5 text-sm">
            Google
            {hasGoogle && <BadgeCheck size={14} className="shrink-0 text-accent-bright" aria-label="Connected" />}
          </strong>
          <span className="mt-0.5 block truncate text-xs text-muted">{email}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-accent-bright">Connected</span>
      </div>

      <div className={`connected-account-row flex items-center gap-3 rounded-xl border px-4 py-3 ${discord ? "border-line-strong bg-ink/5" : "border-dashed border-line-strong"}`}>
        {discord?.avatarUrl ? (
          <Image src={discord.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
            <DiscordIcon className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-1.5 text-sm">
            <span className="truncate">{discord ? `@${discord.username}` : "Discord"}</span>
            {discord && <BadgeCheck size={14} className="shrink-0 text-[#5865F2]" aria-label="Connected" />}
          </strong>
          <span className="mt-0.5 block text-xs text-muted">
            {discord ? "Discord · linked to this account" : "Not connected · link to sign in with Discord"}
          </span>
        </span>
        <div className="connected-account-actions">
          {discord ? (
            <>
              <button type="button" onClick={() => startTransition(() => switchFormAction())} disabled={discordBusy} className="connected-account-action">
                {switchPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {switchPending ? "Switching…" : "Switch account"}
              </button>
              <button type="button" onClick={() => startTransition(() => unlinkFormAction())} disabled={discordBusy} className="connected-account-action is-danger">
                {unlinkPending ? <Loader2 size={13} className="animate-spin" /> : <Link2Off size={13} />}
                {unlinkPending ? "Unlinking…" : "Disconnect"}
              </button>
            </>
          ) : (
            <button type="button" onClick={connectDiscord} disabled={discordBusy} className="connected-account-action is-discord">
              {oauthPending ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
              {oauthPending ? "Connecting…" : "Connect"}
            </button>
          )}
        </div>
      </div>

      <div className="connected-account-row flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
          <MinecraftMark className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-1.5 text-sm">
            <span className="truncate">Minecraft</span>
            <span className="chip">Coming soon</span>
          </strong>
          <span className="mt-0.5 block text-xs text-muted">
            Account linking is not available yet.
          </span>
        </span>
        <div className="connected-account-actions">
          <button type="button" className="connected-account-action" disabled aria-disabled="true">
            <Gamepad2 size={13} /> Coming soon
          </button>
        </div>
      </div>

      <Modal open={minecraftDialog !== null} onClose={() => !minecraftPending && setMinecraftDialog(null)} label={minecraftDialog === "switch" ? "Switch Minecraft account" : "Disconnect Minecraft account"}>
        <div className="panel mx-auto max-w-md border-danger/30 p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold">{minecraftDialog === "switch" ? "Switch Minecraft account?" : "Disconnect Minecraft?"}</h2>
          <p className="mt-2 text-sm text-muted">
            {minecraftDialog === "switch"
              ? "The current player and synced statistics will be removed. You will then be taken to verify a different Minecraft account."
              : "This removes the linked player identity and synced statistics. You can verify the account again later."}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={minecraftPending} onClick={() => setMinecraftDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-ghost btn-sm border-danger/40 text-danger" disabled={minecraftPending} onClick={() => startTransition(() => minecraftDisconnectAction())}>
              {minecraftPending ? <Loader2 size={14} className="animate-spin" /> : minecraftDialog === "switch" ? <RefreshCw size={14} /> : <Unlink size={14} />}
              {minecraftPending ? "Working…" : minecraftDialog === "switch" ? "Switch account" : "Disconnect"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
