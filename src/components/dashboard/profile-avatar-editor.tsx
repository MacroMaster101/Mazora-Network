"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Gamepad2, Loader2, Trash2, Upload, Check } from "lucide-react";
import {
  removeProfileAvatarAction,
  uploadProfileAvatarAction,
  useMinecraftAvatarAction,
} from "@/lib/actions/avatar";
import type { AccountActionResult } from "@/lib/actions/account";
import { Modal, useToast } from "@/components/ui";
import { MinecraftAvatar } from "@/components/shared/minecraft-avatar";

const initialState: AccountActionResult = { ok: false };

export function ProfileAvatarEditor({
  displayName,
  username,
  email,
  avatarUrl,
  enabled,
}: {
  displayName: string;
  username: string;
  email: string;
  avatarUrl?: string;
  enabled: boolean;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadProfileAvatarAction, initialState);
  const [minecraftState, minecraftAction, minecraftPending] = useActionState(useMinecraftAvatarAction, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeProfileAvatarAction, initialState);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showMcModal, setShowMcModal] = useState(false);
  const [mcUsername, setMcUsername] = useState(username || "");
  const { toast } = useToast();
  const router = useRouter();
  const initials = useMemo(
    () => (displayName || username).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    [displayName, username],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!uploadState.message) return;
    toast(uploadState.message, uploadState.ok ? "success" : "error");
    if (uploadState.ok) {
      setFile(null);
      setPreviewUrl(null);
      router.refresh();
    }
  }, [uploadState, router, toast]);

  useEffect(() => {
    if (!minecraftState.message) return;
    toast(minecraftState.message, minecraftState.ok ? "success" : "error");
    if (minecraftState.ok) {
      setShowMcModal(false);
      router.refresh();
    }
  }, [minecraftState, router, toast]);

  useEffect(() => {
    if (!removeState.message) return;
    toast(removeState.message, removeState.ok ? "success" : "error");
    if (removeState.ok) router.refresh();
  }, [removeState, router, toast]);

  const shownAvatar = previewUrl ?? avatarUrl;
  const busy = uploadPending || minecraftPending || removePending;

  return (
    <div className="profile-avatar-editor">
      <div className="profile-avatar-visual">
        <span className="profile-avatar-fallback" aria-label={`${displayName}'s initials`}>{initials}</span>
        {shownAvatar && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob previews and remote avatar sources share this element.
          <img
            src={shownAvatar}
            alt={`${displayName}'s profile photo`}
            className="profile-avatar-image"
            onError={(event) => { event.currentTarget.hidden = true; }}
          />
        )}
        <span className="profile-avatar-camera" aria-hidden="true"><Camera size={15} /></span>
      </div>

      <div className="profile-avatar-content">
        <div className="profile-avatar-identity">
          <div>
            <p className="profile-avatar-name">{displayName}</p>
            <p className="profile-avatar-email">{email || `@${username}`}</p>
          </div>
          <span className="profile-avatar-source">
            {previewUrl ? "New photo" : avatarUrl?.includes("mc-heads.net") ? "Minecraft skin" : avatarUrl ? "Uploaded photo" : "Initials"}
          </span>
        </div>

        <div className="profile-avatar-actions">
          <form action={uploadAction} className="profile-avatar-upload-form">
            <input
              id="profile-avatar-file"
              name="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={!enabled || busy}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                setPreviewUrl((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return nextFile ? URL.createObjectURL(nextFile) : null;
                });
              }}
            />
            <label
              htmlFor="profile-avatar-file"
              className={`btn btn-secondary btn-sm ${!enabled || busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
              aria-disabled={!enabled || busy}
            >
              <Camera size={14} /> Choose photo
            </label>
            {file && (
              <button type="submit" className="btn btn-primary btn-sm" disabled={!enabled || busy}>
                {uploadPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadPending ? "Uploading…" : "Upload photo"}
              </button>
            )}
          </form>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!enabled || busy}
            onClick={() => setShowMcModal(true)}
          >
            <Gamepad2 size={14} />
            Minecraft skin
          </button>

          <form action={removeAction}>
            <button type="submit" className="profile-avatar-remove" disabled={!enabled || !avatarUrl || busy}>
              {removePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Remove
            </button>
          </form>
        </div>

        <p className="profile-avatar-help">
          PNG, JPEG, or WebP · 2 MB max. You can also use your Minecraft Game Name skin!
        </p>
        {uploadState.errors?.avatar && <p className="text-xs text-danger" role="alert">{uploadState.errors.avatar}</p>}
        {!enabled && <p className="text-xs text-muted">Configure Supabase to enable profile photos.</p>}
      </div>

      <Modal open={showMcModal} onClose={() => !minecraftPending && setShowMcModal(false)} label="Set Minecraft skin avatar">
        <div className="panel mx-auto max-w-md p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Gamepad2 className="text-accent-bright" size={20} />
            Use Minecraft Skin
          </h2>
          <p className="mt-2 text-sm text-muted">
            Enter your in-game Minecraft username (for premium or TLauncher/cracked players). We will automatically fetch and set your skin head as your profile avatar.
          </p>

          <form action={minecraftAction} className="mt-5 space-y-4">
            <div className="flex items-center gap-4 rounded-xl border border-line-strong bg-ink/10 p-4">
              <MinecraftAvatar username={mcUsername.trim() || "Steve"} size={56} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <label htmlFor="mc-skin-username-input" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Minecraft IGN / Username
                </label>
                <input
                  id="mc-skin-username-input"
                  name="username"
                  type="text"
                  value={mcUsername}
                  onChange={(e) => setMcUsername(e.target.value)}
                  placeholder="e.g. KaviYa"
                  maxLength={16}
                  required
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {minecraftState.message && !minecraftState.ok && (
              <p className="text-xs font-semibold text-danger">{minecraftState.message}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={minecraftPending}
                onClick={() => setShowMcModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={minecraftPending || !mcUsername.trim()}
              >
                {minecraftPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {minecraftPending ? "Saving…" : "Set Profile Photo"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}