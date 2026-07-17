"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import Image from "next/image";
import { BadgeCheck, Link2Off, Loader2, LogIn } from "lucide-react";
import { oauthAction, unlinkDiscordAction, type AuthResult } from "@/lib/actions/auth";
import type { DiscordIdentity } from "@/lib/types";
import { DiscordIcon, GoogleIcon } from "@/components/auth/provider-icons";
import { useToast } from "@/components/ui";

const initialAuth: AuthResult = { ok: false };

interface ConnectedAccountsProps {
  email: string;
  hasGoogle: boolean;
  initialDiscord: DiscordIdentity | null;
}

export function ConnectedAccounts({ email, hasGoogle, initialDiscord }: ConnectedAccountsProps) {
  const [discord, setDiscord] = useState<DiscordIdentity | null>(initialDiscord);
  const [oauthState, oauthFormAction, oauthPending] = useActionState(oauthAction, initialAuth);
  const [unlinkState, unlinkFormAction, unlinkPending] = useActionState(unlinkDiscordAction, initialAuth);
  const { toast } = useToast();

  useEffect(() => {
    if (!oauthState.ok && oauthState.message) toast(oauthState.message, "error");
  }, [oauthState, toast]);

  useEffect(() => {
    if (unlinkState.message) {
      toast(unlinkState.message, unlinkState.ok ? "success" : "error");
      if (unlinkState.ok) setDiscord(null);
    }
  }, [unlinkState, toast]);

  const connectDiscord = () => {
    const formData = new FormData();
    formData.append("provider", "discord");
    formData.append("next", "/dashboard/settings");
    startTransition(() => {
      oauthFormAction(formData);
    });
  };

  const disconnectDiscord = () => {
    startTransition(() => {
      unlinkFormAction();
    });
  };

  return (
    <div className="space-y-3">
      {/* Google */}
      <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-ink/5 px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
          <GoogleIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-1.5 text-sm">
            Google
            {hasGoogle && <BadgeCheck size={14} className="text-accent-bright shrink-0" aria-label="Connected" />}
          </strong>
          <span className="mt-0.5 block truncate text-xs text-muted">{email}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-accent-bright">Connected</span>
      </div>

      {/* Discord */}
      {discord ? (
        <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-ink/5 px-4 py-3">
          {discord.avatarUrl ? (
            <Image
              src={discord.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full"
            />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
              <DiscordIcon className="h-5 w-5" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <strong className="flex items-center gap-1.5 text-sm">
              <span className="truncate">@{discord.username}</span>
              <BadgeCheck size={14} className="text-[#5865F2] shrink-0" aria-label="Connected" />
            </strong>
            <span className="mt-0.5 block text-xs text-muted">Discord · linked to this account</span>
          </span>
          <button
            type="button"
            onClick={disconnectDiscord}
            disabled={unlinkPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {unlinkPending ? <Loader2 size={13} className="animate-spin" /> : <Link2Off size={13} />}
            {unlinkPending ? "Unlinking…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
            <DiscordIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="text-sm">Discord</strong>
            <span className="mt-0.5 block text-xs text-muted">Not connected · link to sign in with Discord</span>
          </span>
          <button
            type="button"
            onClick={connectDiscord}
            disabled={oauthPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/10 px-3 py-1.5 text-xs font-semibold text-[#5865F2] transition hover:bg-[#5865F2]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {oauthPending ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
            {oauthPending ? "Connecting…" : "Connect"}
          </button>
        </div>
      )}
    </div>
  );
}
