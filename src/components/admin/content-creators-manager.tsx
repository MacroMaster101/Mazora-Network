"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Home, ImageIcon, Link as LinkIcon, Loader2, Pencil, Plus, Radio, Trash2, UploadCloud, UsersRound, Video, X } from "lucide-react";
import { deleteContentCreator, saveContentCreator, type ContentCreatorActionResult } from "@/lib/actions/content-creators";
import type { ContentCreator } from "@/lib/data/content-creators";
import { SOCIAL_PLATFORMS, socialLabel, type CreatorSocial } from "@/lib/creator-socials";
import { SocialIcon } from "@/components/admin/social-icons";
import { FormRow, Input, Modal, Textarea, useToast } from "@/components/ui";

const initialState: ContentCreatorActionResult = { ok: false };

interface Draft {
  id?: string;
  name: string;
  profileImageUrl: string;
  bio: string;
  socials: CreatorSocial[];
  publicVisible: boolean;
  featuredOnHome: boolean;
}

const emptyDraft: Draft = {
  name: "",
  profileImageUrl: "",
  bio: "",
  socials: [],
  publicVisible: true,
  featuredOnHome: false,
};

function toDraft(creator: ContentCreator): Draft {
  return {
    id: creator.id,
    name: creator.name,
    profileImageUrl: creator.profileImageUrl ?? "",
    bio: creator.bio ?? "",
    socials: creator.socials.map((social) => ({ ...social })),
    publicVisible: creator.publicVisible,
    featuredOnHome: creator.featuredOnHome,
  };
}

function CreatorAvatar({ creator, large = false }: { creator: Pick<Draft, "name" | "profileImageUrl" | "socials">; large?: boolean }) {
  const fallbackPlatform = creator.socials[0]?.platform;
  return (
    <span className={large ? "content-creator-admin-avatar is-large" : "content-creator-admin-avatar"}>
      {creator.profileImageUrl ? (
        // The editor previews local and approved remote URLs before a save; a plain image handles both forms.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={creator.profileImageUrl} alt="" loading="lazy" decoding="async" />
      ) : fallbackPlatform ? (
        <SocialIcon platform={fallbackPlatform} size={large ? 24 : 19} />
      ) : (
        creator.name.slice(0, 1).toUpperCase() || "?"
      )}
    </span>
  );
}

function CreatorPlatformSelect({ value, unavailable, onChange }: {
  value: CreatorSocial["platform"];
  unavailable: Set<CreatorSocial["platform"]>;
  onChange: (platform: CreatorSocial["platform"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = SOCIAL_PLATFORMS.find((platform) => platform.key === value) ?? SOCIAL_PLATFORMS[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="creator-platform-picker" ref={rootRef}>
      <button
        type="button"
        className="creator-platform-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Platform: ${selected.label}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="creator-platform-trigger-icon" aria-hidden="true"><SocialIcon platform={selected.key} size={17} /></span>
        <strong>{selected.label}</strong>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="creator-platform-options" role="listbox" aria-label="Creator platform">
          {SOCIAL_PLATFORMS.map((platform) => {
            const disabled = unavailable.has(platform.key);
            return (
              <button
                type="button"
                role="option"
                aria-selected={platform.key === value}
                disabled={disabled}
                key={platform.key}
                onClick={() => {
                  onChange(platform.key);
                  setOpen(false);
                }}
              >
                <span aria-hidden="true"><SocialIcon platform={platform.key} size={16} /></span>
                <span>{platform.label}</span>
                {platform.key === value && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ContentCreatorsManager({ creators }: { creators: ContentCreator[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveContentCreator, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteContentCreator, initialState);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const publicCount = creators.filter((creator) => creator.publicVisible).length;
  const featuredCount = creators.filter((creator) => creator.featuredOnHome).length;

  useEffect(() => {
    if (!saveState.message) return;
    toast(saveState.message, saveState.ok ? "success" : "error");
    if (saveState.ok) {
      setDraft(null);
      setProfileImageFile(null);
      setProfileImagePreview("");
    }
  }, [saveState, toast]);

  useEffect(() => {
    if (!deleteState.message) return;
    toast(deleteState.message, deleteState.ok ? "success" : "error");
    if (deleteState.ok) setConfirmDelete(null);
  }, [deleteState, toast]);

  const submit = () => {
    if (!draft) return;
    const data = new FormData();
    if (draft.id) data.append("id", draft.id);
    data.append("name", draft.name);
    data.append("profileImageUrl", draft.profileImageUrl);
    data.append("bio", draft.bio);
    data.append("socials", JSON.stringify(draft.socials.filter((social) => social.url.trim())));
    data.append("publicVisible", draft.publicVisible ? "true" : "false");
    data.append("featuredOnHome", draft.featuredOnHome ? "true" : "false");
    if (profileImageFile) data.append("profileImageFile", profileImageFile);
    startTransition(() => saveAction(data));
  };

  const remove = (id: string) => {
    const data = new FormData();
    data.append("id", id);
    startTransition(() => deleteAction(data));
  };

  return (
    <div className="content-creators-workspace">
      <header className="content-creators-page-head">
        <div className="content-creators-page-title">
          <span className="content-creators-page-icon" aria-hidden="true"><Video size={22} /></span>
          <div>
            <h1>Content Creators</h1>
            <p>Manage the people and channels featured across Mazora.</p>
          </div>
        </div>
        <div className="content-creators-page-actions">
          <dl className="content-creators-summary" aria-label="Creator profile summary">
            <div><dt>Total</dt><dd>{creators.length}</dd></div>
            <div><dt>Public</dt><dd>{publicCount}</dd></div>
            <div><dt>Featured</dt><dd>{featuredCount}</dd></div>
          </dl>
          <button type="button" className="btn btn-primary" onClick={() => {
            setImageMode("upload");
            setProfileImageFile(null);
            setProfileImagePreview("");
            setDraft({ ...emptyDraft });
          }}>
            <Plus size={16} /> Add creator
          </button>
        </div>
      </header>

      <section className="content-creators-directory" aria-labelledby="creator-directory-title">
        <div className="content-creators-directory-head">
          <div>
            <h2 id="creator-directory-title">Creator directory</h2>
            <p>Profiles marked public appear on the creator program page.</p>
          </div>
          <span><UsersRound size={15} /> {creators.length} {creators.length === 1 ? "profile" : "profiles"}</span>
        </div>

        {creators.length === 0 ? (
          <div className="content-creators-empty">
            <span className="content-creators-empty-icon" aria-hidden="true"><Radio size={24} /></span>
            <h2>No creator profiles yet</h2>
            <p>Add the first creator when you have their profile image and active channel links ready.</p>
          </div>
        ) : (
          <div className="content-creators-admin-grid">
            {creators.map((creator) => (
            <article key={creator.id} className="content-creator-admin-card panel">
              <CreatorAvatar creator={{ name: creator.name, profileImageUrl: creator.profileImageUrl ?? "", socials: creator.socials }} large />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2>{creator.name}</h2>
                  <span className={creator.publicVisible ? "creator-admin-state is-public" : "creator-admin-state"}>
                    {creator.publicVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                    {creator.publicVisible ? "Public" : "Hidden"}
                  </span>
                  {creator.featuredOnHome && <span className="creator-admin-state is-featured"><Home size={12} /> Home</span>}
                </div>
                {creator.bio && <p>{creator.bio}</p>}
                <div className="creator-admin-socials" aria-label={`${creator.name} channels`}>
                  {creator.socials.map((social) => (
                    <span key={`${social.platform}-${social.url}`} title={socialLabel(social.platform)}>
                      <SocialIcon platform={social.platform} size={14} />
                    </span>
                  ))}
                  {creator.socials.length === 0 && <small>No channels added</small>}
                </div>
              </div>
              <div className="content-creator-admin-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                  setImageMode(creator.profileImageUrl ? "url" : "upload");
                  setProfileImageFile(null);
                  setProfileImagePreview("");
                  setDraft(toDraft(creator));
                }}>
                  <Pencil size={13} /> Edit
                </button>
                {confirmDelete === creator.id ? (
                  <span className="flex gap-1">
                    <button type="button" className="btn btn-sm text-danger" disabled={deletePending} onClick={() => remove(creator.id)}>
                      {deletePending ? <Loader2 size={13} className="animate-spin" /> : "Delete"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setConfirmDelete(creator.id)}>
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            </article>
            ))}
          </div>
        )}
      </section>

      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} label="Content creator profile" size="default">
        {draft && (
          <div className="content-creator-editor panel">
            <header>
              <CreatorAvatar creator={{ ...draft, profileImageUrl: profileImagePreview || draft.profileImageUrl }} large />
              <div>
                <h2>{draft.id ? "Edit content creator" : "Add content creator"}</h2>
                <p>Create one clear identity for every place this creator appears.</p>
              </div>
            </header>
            <div className="content-creator-editor-body">
              <section className="creator-editor-section">
                <div className="creator-editor-section-heading">
                  <span aria-hidden="true"><ImageIcon size={16} /></span>
                  <div><h3>Profile details</h3><p>Name, image, and the short introduction visitors will see.</p></div>
                </div>
                <div className="creator-profile-fields">
                  <FormRow label="Creator name" htmlFor="creator-name" error={saveState.errors?.name}>
                    <Input id="creator-name" value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                  </FormRow>
                  <div className="creator-image-field">
                    <div className="creator-image-field-head">
                      <span>Profile image <small>Optional</small></span>
                    </div>
                    <input
                      ref={profileImageInputRef}
                      className="sr-only"
                      id="creator-image-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setProfileImageFile(file);
                        if (!file) {
                          setProfileImagePreview("");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setProfileImagePreview(typeof reader.result === "string" ? reader.result : "");
                        reader.readAsDataURL(file);
                      }}
                    />
                    <div className="creator-image-control">
                      {imageMode === "upload" ? (
                        <label className="creator-image-upload" htmlFor="creator-image-file">
                          <UploadCloud size={17} />
                          <span>{profileImageFile?.name || "Choose an image"}</span>
                          <small>PNG, JPG, WebP, or GIF up to 8 MB</small>
                        </label>
                      ) : (
                        <Input id="creator-image" value={draft.profileImageUrl} maxLength={2000} placeholder="Paste a direct image link" onChange={(event) => {
                          setProfileImageFile(null);
                          setProfileImagePreview("");
                          if (profileImageInputRef.current) profileImageInputRef.current.value = "";
                          setDraft({ ...draft, profileImageUrl: event.target.value });
                        }} />
                      )}
                      <div className="creator-image-mode" aria-label="Profile image source">
                        <button type="button" className={imageMode === "upload" ? "is-active" : ""} onClick={() => setImageMode("upload")}><UploadCloud size={13} /> Upload</button>
                        <button type="button" className={imageMode === "url" ? "is-active" : ""} onClick={() => setImageMode("url")}><LinkIcon size={13} /> URL</button>
                      </div>
                    </div>
                    {saveState.errors?.profileImageUrl && <p className="text-xs font-semibold text-danger">{saveState.errors.profileImageUrl}</p>}
                    <p className="creator-image-fallback-note">Leave this blank to use the first channel&apos;s platform icon.</p>
                  </div>
                </div>
                <FormRow label="Short public intro" htmlFor="creator-bio" error={saveState.errors?.bio}>
                  <Textarea id="creator-bio" rows={3} value={draft.bio} maxLength={180} placeholder="What this creator makes and streams." onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
                </FormRow>
              </section>

              <section className="creator-editor-section creator-channel-editor">
                <div className="flex items-center justify-between gap-3">
                  <div className="creator-editor-section-heading">
                    <span aria-hidden="true"><Radio size={16} /></span>
                    <div><h3>Channel links</h3><p>Add every platform where this creator publishes or streams.</p></div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={draft.socials.length >= SOCIAL_PLATFORMS.length}
                    onClick={() => {
                      const used = new Set(draft.socials.map((social) => social.platform));
                      const next = SOCIAL_PLATFORMS.find((platform) => !used.has(platform.key));
                      if (next) setDraft({ ...draft, socials: [...draft.socials, { platform: next.key, url: "" }] });
                    }}
                  >
                    <Plus size={13} /> Add channel
                  </button>
                </div>
                {draft.socials.length === 0 ? (
                  <p className="creator-channel-empty">No channels added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {draft.socials.map((social, index) => (
                      <div className="creator-channel-row" key={index}>
                        <CreatorPlatformSelect
                          value={social.platform}
                          unavailable={new Set(draft.socials.filter((_, itemIndex) => itemIndex !== index).map((item) => item.platform))}
                          onChange={(platform) => {
                            const next = [...draft.socials];
                            next[index] = { ...social, platform };
                            setDraft({ ...draft, socials: next });
                          }}
                        />
                        <Input
                          aria-label={`${socialLabel(social.platform)} URL`}
                          value={social.url}
                          placeholder="https://..."
                          onChange={(event) => {
                            const next = [...draft.socials];
                            next[index] = { ...social, url: event.target.value };
                            setDraft({ ...draft, socials: next });
                          }}
                        />
                        <button type="button" className="btn btn-ghost btn-sm text-danger creator-channel-remove" aria-label={`Remove ${socialLabel(social.platform)}`} onClick={() => setDraft({ ...draft, socials: draft.socials.filter((_, itemIndex) => itemIndex !== index) })}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {saveState.errors?.socials && <p className="text-xs font-semibold text-danger">{saveState.errors.socials}</p>}
              </section>

              <section className="creator-editor-section">
                <div className="creator-editor-section-heading">
                  <span aria-hidden="true"><Eye size={16} /></span>
                  <div><h3>Publishing</h3><p>Choose where this profile appears. Creator ribbons rotate automatically.</p></div>
                </div>
                <div className="creator-publish-options">
                  <label>
                    <input type="checkbox" checked={draft.publicVisible} onChange={(event) => setDraft({ ...draft, publicVisible: event.target.checked, featuredOnHome: event.target.checked ? draft.featuredOnHome : false })} />
                    <span><strong>Public profile</strong><small>Show on the Content Creator page.</small></span>
                  </label>
                  <label className={!draft.publicVisible ? "is-disabled" : ""}>
                    <input type="checkbox" checked={draft.featuredOnHome} disabled={!draft.publicVisible} onChange={(event) => setDraft({ ...draft, featuredOnHome: event.target.checked })} />
                    <span><strong>Feature on homepage</strong><small>Add to the creator spotlight.</small></span>
                  </label>
                </div>
              </section>
            </div>
            <footer>
              <span><Video size={14} /> {draft.socials.length} {draft.socials.length === 1 ? "channel" : "channels"}</span>
              <div>
                <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={savePending} onClick={submit}>
                  {savePending ? <Loader2 size={15} className="animate-spin" /> : "Save creator"}
                </button>
              </div>
            </footer>
          </div>
        )}
      </Modal>
    </div>
  );
}
