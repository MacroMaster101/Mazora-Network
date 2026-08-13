"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Gamepad2, Loader2, Search, Trash2, Upload, Check, X } from "lucide-react";
import { DiscordIcon } from "@/components/auth/provider-icons";
import {
  removeProfileAvatarAction,
  uploadProfileAvatarAction,
  useDiscordAvatarAction,
  useMinecraftAvatarAction,
} from "@/lib/actions/avatar";
import {
  removeMinecraftSkinAction,
  uploadMinecraftSkinAction,
  type SkinUploadActionState,
} from "@/lib/actions/minecraft";
import type { AccountActionResult } from "@/lib/actions/account";
import { Modal, useToast } from "@/components/ui";
import { MinecraftAvatar } from "@/components/shared/minecraft-avatar";

const initialState: AccountActionResult = { ok: false };
const initialSkinUploadState: SkinUploadActionState = { ok: false };

export function ProfileAvatarEditor({
  displayName,
  username,
  email,
  avatarUrl,
  hasDiscordPhoto = false,
  enabled,
}: {
  displayName: string;
  username: string;
  email: string;
  avatarUrl?: string;
  /** Only offer the Discord option when that account actually has a photo. */
  hasDiscordPhoto?: boolean;
  enabled: boolean;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadProfileAvatarAction, initialState);
  const [minecraftState, minecraftAction, minecraftPending] = useActionState(useMinecraftAvatarAction, initialState);
  const [discordState, discordAction, discordPending] = useActionState(useDiscordAvatarAction, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeProfileAvatarAction, initialState);
  const [skinUploadState, skinUploadAction, skinUploadPending] = useActionState(uploadMinecraftSkinAction, initialSkinUploadState);
  const [skinRemoveState, skinRemoveAction, skinRemovePending] = useActionState(removeMinecraftSkinAction, initialSkinUploadState);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showMcModal, setShowMcModal] = useState(false);
  const [mcUsername, setMcUsername] = useState(username || "");
  const [skinFile, setSkinFile] = useState<File | null>(null);
  const [skinPreviewUrl, setSkinPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const initials = useMemo(
    () => (displayName || username).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    [displayName, username],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => {
    if (skinPreviewUrl) URL.revokeObjectURL(skinPreviewUrl);
  }, [skinPreviewUrl]);

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
    if (!discordState.message) return;
    toast(discordState.message, discordState.ok ? "success" : "error");
    if (discordState.ok) router.refresh();
  }, [discordState, router, toast]);

  useEffect(() => {
    if (!removeState.message) return;
    toast(removeState.message, removeState.ok ? "success" : "error");
    if (removeState.ok) router.refresh();
  }, [removeState, router, toast]);

  useEffect(() => {
    if (!skinUploadState.message) return;
    toast(skinUploadState.message, skinUploadState.ok ? "success" : "error");
    if (skinUploadState.ok) {
      setSkinFile(null);
      setSkinPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setShowMcModal(false);
      router.refresh();
    }
  }, [skinUploadState, router, toast]);

  useEffect(() => {
    if (!skinRemoveState.message) return;
    toast(skinRemoveState.message, skinRemoveState.ok ? "success" : "error");
    if (skinRemoveState.ok) router.refresh();
  }, [skinRemoveState, router, toast]);

  /** Clears a staged file without touching the rest of the modal or closing it. */
  const clearSkinFile = () => {
    setSkinFile(null);
    setSkinPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const shownAvatar = previewUrl ?? avatarUrl;

  // googleusercontent is the photo that came with the Google account, not
  // something the member uploaded — labelling it "Uploaded photo" (the old
  // catch-all) told them they had set a picture they never chose, and left
  // Remove looking broken because clearing it just falls back to the same
  // image again.
  const isProviderPhoto = Boolean(avatarUrl?.includes("googleusercontent.com"));
  // Distinguished from the general mc-heads.net lookup below: this is a file
  // the member uploaded themselves, stored in our own bucket, not a live
  // lookup — the "Remove skin" option (further down) keys off this too.
  const hasCustomSkin = Boolean(avatarUrl?.includes("/skin-head-"));
  const avatarSource = previewUrl
    ? "New photo"
    : hasCustomSkin
      ? "Custom skin"
      : avatarUrl?.includes("mc-heads.net")
        ? "Minecraft skin"
        : avatarUrl?.includes("cdn.discordapp.com")
          ? "Discord photo"
          : isProviderPhoto
            ? "Email photo"
            : avatarUrl
              ? "Uploaded photo"
              : "Initials";
  const busy = uploadPending || minecraftPending || discordPending || removePending || skinUploadPending || skinRemovePending;

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
          <span className="profile-avatar-source">{avatarSource}</span>
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

          {hasDiscordPhoto && (
            <form action={discordAction}>
              <button type="submit" className="btn btn-secondary btn-sm" disabled={!enabled || busy}>
                {discordPending ? <Loader2 size={14} className="animate-spin" /> : <DiscordIcon className="h-3.5 w-3.5" />}
                {discordPending ? "Applying…" : "Discord photo"}
              </button>
            </form>
          )}

          <form action={removeAction}>
            <button
              type="submit"
              className="profile-avatar-remove"
              disabled={!enabled || !avatarUrl || isProviderPhoto || busy}
              title={isProviderPhoto ? "This is your account's email photo — there is nothing stored to remove." : undefined}
            >
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

      <Modal open={showMcModal} onClose={() => !minecraftPending && setShowMcModal(false)} label="Set Minecraft skin avatar" size="compact">
        <div className="panel mx-auto max-w-md p-6 sm:p-7">
          <div className="flex items-center gap-3 pr-12">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent-bright">
              <Gamepad2 size={19} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">Use Minecraft Skin</h2>
              <p className="text-xs text-muted">Fetched by username, or uploaded as a file — your choice.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-line-strong bg-ink/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line-strong bg-card text-muted">
                <Search size={14} />
              </span>
              <h3 className="text-sm font-bold text-ink">Fetch by username</h3>
            </div>
            <p className="text-xs text-muted">
              Works for premium accounts. TLauncher and cracked usernames have no real skin to fetch —
              use <strong className="text-ink">Upload a file</strong> below instead.
            </p>

            <form action={minecraftAction} className="mt-3 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-card p-3">
                <MinecraftAvatar username={mcUsername.trim() || "Steve"} size={48} rounded="rounded-lg" />
                <div className="min-w-0 flex-1">
                  <label htmlFor="mc-skin-username-input" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
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
                    className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {minecraftState.message && !minecraftState.ok && (
                <p className="text-xs font-semibold text-danger">{minecraftState.message}</p>
              )}

              <div className="flex justify-end">
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

          <div className="my-3 flex items-center gap-3 px-1 text-[11px] font-bold uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="rounded-2xl border border-line-strong bg-ink/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line-strong bg-card text-muted">
                <Upload size={13} />
              </span>
              <h3 className="text-sm font-bold text-ink">Upload a skin file</h3>
            </div>
            <p className="text-xs text-muted">
              For TLauncher/cracked accounts, or anyone who wants a custom head. Download a 64×64 skin PNG
              from NameMC or TLauncher&apos;s catalog, then upload it here.
            </p>

            <form action={skinUploadAction} className="mt-3 space-y-3">
              <input
                id="mc-skin-file"
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
              <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-card p-3">
                {skinPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview of the just-picked file, before it's processed server-side.
                  <img
                    src={skinPreviewUrl}
                    alt="Selected skin preview"
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-lg border border-line-strong object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  // No new file picked yet — show the currently uploaded skin
                  // (or the plain username lookup, if there isn't one) so this
                  // card isn't blank while a custom skin is already set.
                  <MinecraftAvatar
                    username={username || "Steve"}
                    skinUrl={hasCustomSkin ? avatarUrl : undefined}
                    size={48}
                    rounded="rounded-lg"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label
                    htmlFor="mc-skin-file"
                    className={`btn btn-secondary btn-sm ${skinUploadPending ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                  >
                    <Upload size={13} /> Choose skin file
                  </label>
                  {skinFile && (
                    <span className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-page px-2.5 py-1 text-xs font-semibold text-ink">
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
                </div>
              </div>

              {skinPreviewUrl && (
                <p className="text-xs text-muted">
                  The head icon is cropped from this file after upload.
                </p>
              )}
              {skinUploadState.message && !skinUploadState.ok && (
                <p className="text-xs font-semibold text-danger">{skinUploadState.message}</p>
              )}

              {skinFile && (
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={skinUploadPending}>
                    {skinUploadPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {skinUploadPending ? "Uploading…" : "Upload skin"}
                  </button>
                </div>
              )}
            </form>

            {hasCustomSkin && !skinFile && (
              <form action={skinRemoveAction} className="mt-3 border-t border-line-strong/60 pt-3">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                  disabled={busy}
                >
                  {skinRemovePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {skinRemovePending ? "Removing…" : "Remove uploaded skin"}
                </button>
                {skinRemoveState.message && !skinRemoveState.ok && (
                  <p className="mt-1.5 text-xs font-semibold text-danger">{skinRemoveState.message}</p>
                )}
              </form>
            )}
          </div>

        </div>
      </Modal>
    </div>
  );
}
