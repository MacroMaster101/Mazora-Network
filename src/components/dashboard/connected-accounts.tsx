"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, Gamepad2, ImagePlus, Link2Off, Loader2, LogIn, RefreshCw, Trash2, Unlink, Upload, Check, X } from "lucide-react";
import {
  oauthAction,
  switchDiscordAction,
  unlinkDiscordAction,
  type AuthResult,
} from "@/lib/actions/auth";
import { disconnectMinecraftAction, type AccountActionResult } from "@/lib/actions/account";
import {
  linkMinecraftUsernameAction,
  removeMinecraftSkinAction,
  uploadMinecraftSkinAction,
  type MinecraftLinkActionState,
  type SkinUploadActionState,
} from "@/lib/actions/minecraft";
import type { DiscordIdentity } from "@/lib/types";
import { DiscordIcon, GoogleIcon } from "@/components/auth/provider-icons";
import { MinecraftMark } from "@/components/shared/minecraft-mark";
import { MinecraftAvatar } from "@/components/shared/minecraft-avatar";
import { Modal, useToast } from "@/components/ui";

const initialAuth: AuthResult = { ok: false };
const initialAccount: AccountActionResult = { ok: false };
const initialLinkState: MinecraftLinkActionState = { ok: false, enabled: true };
const initialSkinState: SkinUploadActionState = { ok: false };

interface MinecraftIdentity {
  username: string;
  uuid: string;
  linkedAt: string;
  skinUrl: string | null;
}

interface ConnectedAccountsProps {
  email: string;
  hasGoogle: boolean;
  initialDiscord: DiscordIdentity | null;
  initialMinecraft: MinecraftIdentity | null;
}

type MinecraftDialog = "link" | "switch" | "disconnect" | "skin" | null;

export function ConnectedAccounts({ email, hasGoogle, initialDiscord, initialMinecraft }: ConnectedAccountsProps) {
  const [discord, setDiscord] = useState<DiscordIdentity | null>(initialDiscord);
  const [minecraft, setMinecraft] = useState<MinecraftIdentity | null>(initialMinecraft);
  const [minecraftDialog, setMinecraftDialog] = useState<MinecraftDialog>(null);
  const [inputUsername, setInputUsername] = useState(initialMinecraft?.username || "");
  const [skinFile, setSkinFile] = useState<File | null>(null);
  const [skinPreviewUrl, setSkinPreviewUrl] = useState<string | null>(null);
  const [oauthState, oauthFormAction, oauthPending] = useActionState(oauthAction, initialAuth);
  const [unlinkState, unlinkFormAction, unlinkPending] = useActionState(unlinkDiscordAction, initialAuth);
  const [switchState, switchFormAction, switchPending] = useActionState(switchDiscordAction, initialAuth);
  const [minecraftDisconnectState, minecraftDisconnectFormAction, minecraftDisconnectPending] = useActionState(
    disconnectMinecraftAction,
    initialAccount,
  );
  const [linkState, linkFormAction, linkPending] = useActionState(linkMinecraftUsernameAction, initialLinkState);
  const [skinUploadState, skinUploadFormAction, skinUploadPending] = useActionState(uploadMinecraftSkinAction, initialSkinState);
  const [skinRemoveState, skinRemoveFormAction, skinRemovePending] = useActionState(removeMinecraftSkinAction, initialSkinState);

  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
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
    if (!minecraftDisconnectState.message) return;
    toast(minecraftDisconnectState.message, minecraftDisconnectState.ok ? "success" : "error");
    if (minecraftDisconnectState.ok) {
      setMinecraft(null);
      setMinecraftDialog(null);
      router.refresh();
    }
  }, [minecraftDisconnectState, router, toast]);

  useEffect(() => {
    if (!linkState.message) return;
    toast(linkState.message, linkState.ok ? "success" : "error");
    if (linkState.ok && linkState.linked) {
      // Changing IGN never clears an uploaded skin (linkMinecraftUsernameAction
      // updates the same account row rather than replacing it) — carry the
      // current skin forward rather than dropping it here.
      setMinecraft((prev) => ({
        username: linkState.linked!.username,
        uuid: linkState.linked!.uuid,
        linkedAt: linkState.linked!.linkedAt,
        skinUrl: prev?.skinUrl ?? null,
      }));
      setMinecraftDialog(null);
      router.refresh();
    }
  }, [linkState, router, toast]);

  // Resyncs local state after a server-driven refresh (e.g. router.refresh()
  // following a skin upload/removal elsewhere on this page) — the useState
  // above only seeds from this prop once, so without this effect a fresh
  // skinUrl arriving via new props would never reach the rendered avatar.
  useEffect(() => {
    setMinecraft(initialMinecraft);
  }, [initialMinecraft]);

  useEffect(() => () => {
    if (skinPreviewUrl) URL.revokeObjectURL(skinPreviewUrl);
  }, [skinPreviewUrl]);

  useEffect(() => {
    if (!skinUploadState.message) return;
    toast(skinUploadState.message, skinUploadState.ok ? "success" : "error");
    if (skinUploadState.ok) {
      setSkinFile(null);
      setSkinPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setMinecraftDialog(null);
      router.refresh();
    }
  }, [skinUploadState, router, toast]);

  useEffect(() => {
    if (!skinRemoveState.message) return;
    toast(skinRemoveState.message, skinRemoveState.ok ? "success" : "error");
    if (skinRemoveState.ok) router.refresh();
  }, [skinRemoveState, router, toast]);

  /** Clears a staged skin file without closing the modal or touching anything else in it. */
  const clearSkinFile = () => {
    setSkinFile(null);
    setSkinPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

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

      <div className={`connected-account-row flex items-center gap-3 rounded-xl border px-4 py-3 ${minecraft ? "border-line-strong bg-ink/5" : "border-dashed border-line-strong"}`}>
        {minecraft ? (
          // Deliberately the plain username lookup, not the uploaded skin —
          // this row is about the linked identity itself. The skin override
          // shows everywhere the account is actually represented (dashboard
          // header, public player pages), managed via the button below.
          <MinecraftAvatar username={minecraft.username} size={40} rounded="rounded-full" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-card">
            <MinecraftMark className="h-6 w-6" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-1.5 text-sm">
            <span className="truncate">{minecraft ? minecraft.username : "Minecraft"}</span>
            {minecraft && <BadgeCheck size={14} className="shrink-0 text-accent-bright" aria-label="Connected" />}
          </strong>
          <span className="mt-0.5 block text-xs text-muted">
            {minecraft ? "Minecraft Game Name linked" : "Link your Minecraft IGN for skin photo & player stats"}
          </span>
        </span>
        <div className="connected-account-actions">
          {minecraft ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setInputUsername(minecraft.username);
                  setMinecraftDialog("link");
                }}
                disabled={linkPending || minecraftDisconnectPending}
                className="connected-account-action"
              >
                <RefreshCw size={13} />
                Change IGN
              </button>
              <button
                type="button"
                onClick={() => setMinecraftDialog("skin")}
                disabled={skinUploadPending || skinRemovePending || minecraftDisconnectPending}
                className="connected-account-action"
              >
                <ImagePlus size={13} />
                {minecraft.skinUrl ? "Change skin" : "Add skin"}
              </button>
              <button
                type="button"
                onClick={() => setMinecraftDialog("disconnect")}
                disabled={linkPending || minecraftDisconnectPending}
                className="connected-account-action is-danger"
              >
                <Link2Off size={13} />
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setInputUsername("");
                setMinecraftDialog("link");
              }}
              disabled={linkPending || minecraftDisconnectPending}
              className="connected-account-action"
            >
              <Gamepad2 size={13} />
              Connect IGN
            </button>
          )}
        </div>
      </div>

      <Modal open={minecraftDialog === "link"} onClose={() => !linkPending && setMinecraftDialog(null)} label="Link Minecraft IGN">
        <div className="panel mx-auto max-w-md p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Gamepad2 className="text-accent-bright" size={20} />
            {minecraft ? "Change Minecraft IGN" : "Link Minecraft IGN"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Enter your Minecraft in-game username (Premium, TLauncher, or Cracked). We will load your skin head automatically.
          </p>

          <form action={linkFormAction} className="mt-5 space-y-4">
            <div className="flex items-center gap-4 rounded-xl border border-line-strong bg-ink/10 p-4">
              <MinecraftAvatar username={inputUsername.trim() || "Steve"} size={52} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <label htmlFor="mc-ign-input" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  In-Game Username
                </label>
                <input
                  id="mc-ign-input"
                  name="username"
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  placeholder="e.g. KaviYa"
                  maxLength={16}
                  required
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {linkState.message && !linkState.ok && (
              <p className="text-xs font-semibold text-danger">{linkState.message}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={linkPending}
                onClick={() => setMinecraftDialog(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={linkPending || !inputUsername.trim()}
              >
                {linkPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {linkPending ? "Linking…" : "Save & Link IGN"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal open={minecraftDialog === "disconnect"} onClose={() => !minecraftDisconnectPending && setMinecraftDialog(null)} label="Disconnect Minecraft account">
        <div className="panel mx-auto max-w-md border-danger/30 p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold">Disconnect Minecraft?</h2>
          <p className="mt-2 text-sm text-muted">
            This removes the linked player identity and associated skin head avatar from your account. You can reconnect anytime.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={minecraftDisconnectPending} onClick={() => setMinecraftDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-ghost btn-sm border-danger/40 text-danger" disabled={minecraftDisconnectPending} onClick={() => startTransition(() => minecraftDisconnectFormAction())}>
              {minecraftDisconnectPending ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
              {minecraftDisconnectPending ? "Working…" : "Disconnect"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={minecraftDialog === "skin"}
        onClose={() => {
          if (skinUploadPending || skinRemovePending) return;
          setMinecraftDialog(null);
        }}
        label="Manage Minecraft skin"
      >
        <div className="panel mx-auto max-w-md p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <ImagePlus className="text-accent-bright" size={20} />
            {minecraft?.skinUrl ? "Change skin" : "Add a skin"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            For TLauncher/cracked accounts, whose real skin can&apos;t be looked up by username. Download a
            64×64 skin PNG from NameMC or TLauncher&apos;s catalog, then upload it here.
          </p>

          <form action={skinUploadFormAction} className="mt-5 space-y-3">
            <input
              id="connected-skin-file"
              name="skin"
              type="file"
              accept="image/png"
              className="sr-only"
              disabled={skinUploadPending}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setSkinFile(nextFile);
                setSkinPreviewUrl((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return nextFile ? URL.createObjectURL(nextFile) : null;
                });
              }}
            />
            <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-ink/10 p-4">
              {skinPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview of the just-picked file, before it's processed server-side.
                <img
                  src={skinPreviewUrl}
                  alt="Selected skin preview"
                  width={52}
                  height={52}
                  className="h-[52px] w-[52px] shrink-0 rounded-xl border border-line-strong object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <MinecraftAvatar username={minecraft?.username ?? "Steve"} skinUrl={minecraft?.skinUrl} size={52} rounded="rounded-xl" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <label
                  htmlFor="connected-skin-file"
                  className={`btn btn-secondary btn-sm ${skinUploadPending ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                >
                  <Upload size={14} /> Choose skin file
                </label>
                {skinFile && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-card px-2.5 py-1 text-xs font-semibold text-ink">
                    <span className="min-w-0 truncate">{skinFile.name}</span>
                    <button
                      type="button"
                      onClick={clearSkinFile}
                      disabled={skinUploadPending}
                      aria-label="Clear selected file"
                      className="shrink-0 text-muted hover:text-danger"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {skinPreviewUrl && (
                  <p className="text-xs text-muted">The head icon is cropped from this after upload.</p>
                )}
              </div>
            </div>

            {skinUploadState.message && !skinUploadState.ok && (
              <p className="text-xs font-semibold text-danger">{skinUploadState.message}</p>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              {minecraft?.skinUrl ? (
                <button
                  type="button"
                  className="connected-account-action is-danger"
                  disabled={skinUploadPending || skinRemovePending}
                  onClick={() => startTransition(() => skinRemoveFormAction())}
                >
                  {skinRemovePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {skinRemovePending ? "Removing…" : "Remove skin"}
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={skinUploadPending}
                  onClick={() => setMinecraftDialog(null)}
                >
                  Cancel
                </button>
                {skinFile && (
                  <button type="submit" className="btn btn-primary btn-sm" disabled={skinUploadPending}>
                    {skinUploadPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {skinUploadPending ? "Uploading…" : "Upload skin"}
                  </button>
                )}
              </div>
            </div>
            {skinRemoveState.message && !skinRemoveState.ok && (
              <p className="text-xs font-semibold text-danger">{skinRemoveState.message}</p>
            )}
          </form>
        </div>
      </Modal>
    </div>
  );
}

