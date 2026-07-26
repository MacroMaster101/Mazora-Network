"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Gamepad2, Loader2, Trash2, Upload } from "lucide-react";
import {
  removeProfileAvatarAction,
  uploadProfileAvatarAction,
  useMinecraftAvatarAction,
} from "@/lib/actions/avatar";
import type { AccountActionResult } from "@/lib/actions/account";
import { useToast } from "@/components/ui";

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
    if (minecraftState.ok) router.refresh();
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
          // eslint-disable-next-line @next/next/no-img-element -- local blob previews and two approved remote avatar sources share this element.
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

          <form action={minecraftAction}>
            <button type="submit" className="btn btn-secondary btn-sm" disabled title="Minecraft linking is coming soon">
              <Gamepad2 size={14} />
              Minecraft skin · Coming soon
            </button>
          </form>

          <form action={removeAction}>
            <button type="submit" className="profile-avatar-remove" disabled={!enabled || !avatarUrl || busy}>
              {removePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Remove
            </button>
          </form>
        </div>

        <p className="profile-avatar-help">
          PNG, JPEG, or WebP · 2 MB max. Images are center-cropped everywhere your profile appears.
        </p>
        {uploadState.errors?.avatar && <p className="text-xs text-danger" role="alert">{uploadState.errors.avatar}</p>}
        {!enabled && <p className="text-xs text-muted">Configure Supabase to enable profile photos.</p>}
      </div>
    </div>
  );
}