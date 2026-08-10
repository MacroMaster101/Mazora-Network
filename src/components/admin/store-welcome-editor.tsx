"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import Image from "next/image";
import { Heart, Layout, Save, Sparkles, Upload, CheckCircle2 } from "lucide-react";
import type { StoreWelcomeBannerConfig } from "@/lib/types";
import type { StoreSettingsActionResult } from "@/lib/actions/store-settings";
import { Input, Textarea, useToast } from "@/components/ui";

const IMAGE_PRESETS = [
  { label: "Purple Citadel", desc: "Dark obsidian citadel with glowing amethyst crystals", url: "/images/store/survival-purple-citadel.webp" },
  { label: "Crystal Biome", desc: "Fantasy survival biome with bioluminescent violet trees", url: "/images/store/survival-crystal-biome.webp" },
  { label: "Dungeon Realm", desc: "RPG boss dungeon portal with medieval knight armor", url: "/images/store/survival-dungeon-realm.webp" },
  { label: "Sanctuary Town", desc: "Medieval spawn town surrounded by crystal mountains", url: "/images/store/survival-sanctuary-town.webp" },
];

export function StoreWelcomeEditor({
  banner,
  saveAction,
}: {
  banner: StoreWelcomeBannerConfig;
  saveAction: (formData: FormData) => Promise<StoreSettingsActionResult>;
}) {
  const [badge, setBadge] = useState(banner.badge);
  const [title, setTitle] = useState(banner.title);
  const [paragraph1, setParagraph1] = useState(banner.paragraph1);
  const [paragraph2, setParagraph2] = useState(banner.paragraph2);
  const [supportNote, setSupportNote] = useState(banner.supportNote);
  const [imageUrl, setImageUrl] = useState(banner.imageUrl);
  const [enabled, setEnabled] = useState(banner.enabled);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be smaller than 5MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setImageUrl(result);
        setUploadName(file.name);
        toast(`Uploaded "${file.name}"! Click Save to apply.`, "success");
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <form
      action={(formData) =>
        start(async () => {
          const result = await saveAction(formData);
          toast(result.message, result.ok ? "success" : "error");
        })
      }
      className="store-admin-welcome cr-board mb-6 overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Sparkles size={13} /> Store merchandising
          </p>
          <h2 className="mt-2 font-display text-xl font-black tracking-tight">Welcome Banner Manager</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Edit the top Welcome card shown on Store Home, update description copy, upload custom photos, select Mazora theme artwork presets, or toggle visibility.
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-line bg-card/70 px-4 py-2.5 cursor-pointer hover:border-line-strong">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="checkbox checkbox-primary"
          />
          <span className="text-xs font-bold uppercase tracking-wider text-ink">Show Banner</span>
        </label>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Badge Label</label>
            <Input
              name="badge"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="e.g. EST. 2020 · SURVIVAL RPG EXPERIENCE"
              className="mt-1.5 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Banner Title</label>
            <Input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Welcome to Mazora - Survival"
              className="mt-1.5 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Paragraph 1 (Main Copy)</label>
            <Textarea
              name="paragraph1"
              value={paragraph1}
              onChange={(e) => setParagraph1(e.target.value)}
              rows={4}
              placeholder="Since 2020, Mazora has been dedicated..."
              className="mt-1.5 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Paragraph 2 (Community Copy)</label>
            <Textarea
              name="paragraph2"
              value={paragraph2}
              onChange={(e) => setParagraph2(e.target.value)}
              rows={3}
              placeholder="Whether you're building your dream base..."
              className="mt-1.5 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Support Note Callout</label>
            <Textarea
              name="supportNote"
              value={supportNote}
              onChange={(e) => setSupportNote(e.target.value)}
              rows={3}
              placeholder="Every purchase from our store directly supports..."
              className="mt-1.5 w-full"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-line bg-card/40 p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Photo Upload & Artwork URL</label>
            
            <div className="mt-2.5 flex flex-wrap gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="store-welcome-photo-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary btn-sm gap-2"
              >
                <Upload size={14} /> Upload Photo from Computer
              </button>
              {uploadName && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium py-1">
                  <CheckCircle2 size={13} /> {uploadName}
                </span>
              )}
            </div>

            <div className="mt-3">
              <Input
                name="imageUrl"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setUploadName(null);
                }}
                placeholder="/images/store/... or base64 / http URL"
                className="w-full"
                required
              />
              <p className="mt-1 text-xs text-muted">
                Enter an image URL, path, or upload a photo directly using the button above.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
              Mazora Purple Theme Presets
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {IMAGE_PRESETS.map((preset) => {
                const isSelected = imageUrl === preset.url;
                return (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => {
                      setImageUrl(preset.url);
                      setUploadName(null);
                    }}
                    className={`group relative overflow-hidden rounded-xl border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-violet-400 bg-violet-500/15 ring-2 ring-violet-500/30"
                        : "border-line bg-card/50 hover:border-line-strong hover:bg-card/80"
                    }`}
                  >
                    <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg border border-line/60 bg-black/40">
                      <Image
                        src={preset.url}
                        alt={preset.label}
                        fill
                        sizes="200px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <span className="block font-bold text-xs text-ink">{preset.label}</span>
                    <span className="block text-[0.68rem] text-muted line-clamp-1 mt-0.5">{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-line p-5 bg-card/20">
        <div className="flex items-center justify-between mb-3">
          <span className="telemetry text-xs uppercase tracking-[0.2em] text-accent-bright flex items-center gap-1.5">
            <Layout size={13} /> Full Storefront Live Preview (1:1 Match)
          </span>
          <span className="text-xs text-muted font-medium">
            {enabled ? "Status: Live on Store Home" : "Status: Banner Hidden"}
          </span>
        </div>

        <div className="store-home-welcome-v3 rounded-2xl border border-line bg-surface/90 shadow-2xl p-5 lg:p-7">
          <div className="store-home-welcome-content">
            <div className="store-home-welcome-header">
              <span className="store-home-welcome-pill">
                <Sparkles size={13} /> {badge || "EST. 2020 · SURVIVAL RPG EXPERIENCE"}
              </span>
              <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
                {title || "Welcome to Mazora - Survival"}
              </h2>
            </div>
            <div className="store-home-welcome-body space-y-2 text-xs text-muted sm:text-sm">
              <p>{paragraph1 || "Paragraph 1 preview text will appear here..."}</p>
              <p>{paragraph2 || "Paragraph 2 preview text will appear here..."}</p>
            </div>
            <div className="store-home-welcome-support flex items-start gap-3 rounded-xl border border-line bg-card/60 p-3">
              <div className="store-home-welcome-support-icon shrink-0">
                <Heart size={16} />
              </div>
              <p className="text-xs text-ink/90 font-medium">
                {supportNote || "Support callout preview text..."}
              </p>
            </div>
          </div>

          <div className="store-home-welcome-media">
            <div className="store-home-welcome-media-frame relative aspect-video w-full min-h-[16rem] rounded-xl overflow-hidden border border-violet-400/40">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Preview"
                  fill
                  sizes="400px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black/50 text-xs text-muted">
                  No Image Selected
                </div>
              )}
              <div className="store-home-welcome-media-overlay absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              <div className="store-home-welcome-media-badge absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Minecraft Survival 1.21.11
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
        <p className="text-xs text-muted">Updates take effect immediately across all storefront sessions.</p>
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          <Save size={14} /> {busy ? "Saving…" : "Save Welcome Banner"}
        </button>
      </div>
    </form>
  );
}
