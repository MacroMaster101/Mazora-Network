"use client";

import { useRef, useState, useTransition } from "react";
import {
  Save,
  RefreshCw,
  Globe,
  Radio,
  ToggleLeft,
  Check,
  Share2,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { FormRow, Input, useToast } from "@/components/ui";
import type { SiteGeneralSettings } from "@/lib/data/site-settings";
import { saveSiteGeneralSettingsAction } from "@/lib/actions/site-settings";
import { cn } from "@/lib/utils";

const TAGLINE_SUGGESTIONS = [
  "Build · Survive · Compete · Create",
  "The Next-Gen Minecraft SMP & Minigames Network",
  "Unforgettable Worlds · Fair Competition · Thriving Community",
  "Custom SMP · Skyblock · KitPvP · Competitive Events",
  "Your Ultimate Minecraft Multiplayer Experience",
];

const OG_PRESET_IMAGES = [
  {
    id: "default",
    label: "Hero 3D Emblem",
    url: "/images/og-default.webp",
    desc: "Official 3D M emblem on website hero landscape",
  },
  {
    id: "hero-logo",
    label: "Hero Logo Typography",
    url: "/images/og-preset-hero-logo.webp",
    desc: "Official MAZORA NETWORK 3D logo on hero landscape",
  },
  {
    id: "world-logo",
    label: "World Misty Logo",
    url: "/images/og-preset-web-logo.webp",
    desc: "Official 3D logo on website continuation background",
  },
  {
    id: "world-m",
    label: "World Misty Emblem",
    url: "/images/og-preset-world-m.webp",
    desc: "3D lightning M emblem on website continuation background",
  },
];

function FeatureToggleCard({
  name,
  label,
  desc,
  checked,
  onChange,
  disabled = false,
}: {
  name: string;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  /** A save is in flight; the switch holds still until it lands. */
  disabled?: boolean;
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={0}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }
      }}
      className={cn(
        "group relative flex items-center justify-between gap-4 rounded-2xl border-2 p-5 transition-all duration-250 select-none outline-none",
        disabled ? "cursor-wait" : "cursor-pointer",
        checked
          ? "border-accent bg-accent/15 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
          : "border-line bg-card/60 hover:border-line-strong hover:bg-card/90"
      )}
    >
      <input type="hidden" name={name} value={checked ? "on" : "off"} />

      {/* Subtle glow indicator on the left edge for active toggles */}
      {checked && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-accent shadow-[0_0_10px_rgba(168,85,247,0.6)]" />
      )}

      <div className="min-w-0 flex-1 pl-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[13px] font-bold text-ink group-hover:text-accent-bright transition-colors">
            {label}
          </span>
          <span
            className={cn(
              "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider transition-all inline-flex items-center gap-1",
              checked
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "bg-line/80 text-muted border border-line-strong"
            )}
          >
            {checked && <Check size={10} className="stroke-[3]" />}
            {checked ? "Active" : "Off"}
          </span>
        </div>
        <p className="text-[11px] text-muted mt-1.5 leading-relaxed font-medium">{desc}</p>
      </div>

      {/* Switch track & knob */}
      <div
        className={cn(
          "relative inline-flex h-7 w-[52px] shrink-0 items-center rounded-full transition-all duration-250 ease-in-out border-2",
          checked
            ? "bg-accent border-accent shadow-md shadow-accent/40"
            : "bg-line border-line-strong group-hover:border-muted"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full shadow-md transition-all duration-250 ease-in-out",
            checked
              ? "translate-x-[25px] bg-white shadow-purple-300/30"
              : "translate-x-[3px] bg-white/90"
          )}
        />
      </div>
    </div>
  );
}

/**
 * Which fields each card owns. A card's Save sends only its own fields, merged
 * over what is already saved, so unsaved edits in another card are neither
 * published nor lost.
 */
const SECTIONS = {
  identity: ["name", "shortName", "version", "tagline", "description", "region"],
  sharing: ["ogImageUrl"],
  connection: ["javaIp", "bedrockIp", "bedrockPort", "discord", "discordSupportTickets"],
} as const satisfies Record<string, readonly (keyof SiteGeneralSettings)[]>;

type SectionKey = keyof typeof SECTIONS;

const SECTION_LABELS: Record<SectionKey, string> = {
  identity: "Server identity",
  sharing: "Social sharing",
  connection: "Connection & socials",
};

/** The switches. Each one saves the moment it is flipped — there is nothing to confirm. */
type ToggleKey =
  | "maintenanceMode"
  | "registrationEnabled"
  | "storeEnabled"
  | "suggestionsEnabled"
  | "votingEnabled"
  | "liveMapEnabled";

function pick(settings: SiteGeneralSettings, section: SectionKey): Partial<SiteGeneralSettings> {
  return Object.fromEntries(SECTIONS[section].map((key) => [key, settings[key]])) as Partial<SiteGeneralSettings>;
}

/** The action reads a form: strings as-is, switches as "on" when set. */
function toFormData(settings: SiteGeneralSettings): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === "boolean") {
      if (value) data.set(key, "on");
    } else if (value !== undefined && value !== null) {
      data.set(key, String(value));
    }
  }
  return data;
}

/** Save and Reset for one card, shown at the bottom of that card. */
function CardActions({
  dirty,
  saving,
  busy,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  busy: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      {dirty && !saving && <span className="mr-auto text-xs font-semibold text-muted">Unsaved changes</span>}
      <button
        type="button"
        onClick={onReset}
        disabled={!dirty || busy}
        className="btn btn-ghost btn-sm flex items-center gap-1.5 text-muted hover:text-ink disabled:opacity-60"
      >
        <RefreshCw size={14} />
        Reset
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || busy}
        className="btn btn-primary btn-sm flex min-w-[110px] items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save size={14} />
            Save
          </>
        )}
      </button>
    </div>
  );
}

export function SiteSettingsEditor({
  initialSettings,
}: {
  initialSettings: SiteGeneralSettings;
}) {
  const { toast } = useToast();
  // What is published, so each card knows whether it has unsaved changes.
  const [saved, setSaved] = useState<SiteGeneralSettings>(initialSettings);
  const [formState, setFormState] = useState<SiteGeneralSettings>(initialSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);
  const [, startTransition] = useTransition();
  const [imageTab, setImageTab] = useState<"presets" | "custom" | "upload">("presets");
  const [previewPlatform, setPreviewPlatform] = useState<"discord" | "twitter" | "whatsapp" | "facebook" | "google">("discord");
  const [customInputUrl, setCustomInputUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty = (section: SectionKey) =>
    SECTIONS[section].some((key) => formState[key] !== saved[key]);

  const saveSection = (section: SectionKey) => {
    const next: SiteGeneralSettings = { ...saved, ...pick(formState, section) };
    setSavingSection(section);
    startTransition(async () => {
      const result = await saveSiteGeneralSettingsAction(null, toFormData(next));
      setSavingSection(null);
      if (result.ok) {
        setSaved(next);
        setErrors((current) => {
          const rest = { ...current };
          for (const key of SECTIONS[section]) delete rest[key];
          return rest;
        });
        toast(`${SECTION_LABELS[section]} saved.`, "success");
      } else {
        setErrors(result.errors ?? {});
        toast(result.message, "error");
      }
    });
  };

  const resetSection = (section: SectionKey) => {
    setFormState((current) => ({ ...current, ...pick(saved, section) }));
    setErrors((current) => {
      const rest = { ...current };
      for (const key of SECTIONS[section]) delete rest[key];
      return rest;
    });
    toast(`${SECTION_LABELS[section]} restored to the saved version.`, "info");
  };

  /*
    A switch saves on its own, on top of what is already saved, so flipping one
    never publishes half-finished edits from another card. Shown flipped at
    once; if the save fails it flips back. Switches hold still while any save
    is in flight, so two quick flips cannot race each other.
  */
  const saveToggle = (key: ToggleKey, value: boolean, label: string) => {
    const next: SiteGeneralSettings = { ...saved, [key]: value };
    setFormState((current) => ({ ...current, [key]: value }));
    setSavingToggle(true);
    startTransition(async () => {
      const result = await saveSiteGeneralSettingsAction(null, toFormData(next));
      setSavingToggle(false);
      if (result.ok) {
        setSaved(next);
        toast(`${label} ${value ? "turned on" : "turned off"}.`, "success");
      } else {
        setFormState((current) => ({ ...current, [key]: saved[key] }));
        toast(result.message, "error");
      }
    });
  };

  const actionsFor = (section: SectionKey) => (
    <CardActions
      dirty={isDirty(section)}
      saving={savingSection === section}
      busy={savingSection !== null || savingToggle}
      onSave={() => saveSection(section)}
      onReset={() => resetSection(section)}
    />
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please select a valid image file.", "error");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast("Image size should be under 2MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setFormState((prev) => ({ ...prev, ogImageUrl: dataUrl }));
        toast("Custom image loaded into preview.", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const activeOgImage = formState.ogImageUrl || "/images/og-default.webp";
  const shareTitle = `${formState.name || "Mazora Network"} — ${formState.tagline || "Build · Survive · Compete · Create"}`;
  const shareDesc = formState.description || "A player-first Minecraft network built around unforgettable worlds, fair competition, and a community worth staying for.";

  return (
    <div className="space-y-6">

      {/* Identity Section */}
      <section className="panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Globe size={18} className="text-accent-bright" />
          <h2 className="font-display text-base font-bold text-ink">Server Identity</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormRow label="Server Name" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              value={formState.name}
              onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Mazora Network"
              required
            />
          </FormRow>

          <FormRow label="Short Name / Mark" htmlFor="shortName" error={errors.shortName}>
            <Input
              id="shortName"
              name="shortName"
              value={formState.shortName}
              onChange={(e) => setFormState((p) => ({ ...p, shortName: e.target.value }))}
              placeholder="e.g. MAZORA"
              required
            />
          </FormRow>

          <FormRow label="Supported Minecraft Version" htmlFor="version" error={errors.version}>
            <Input
              id="version"
              name="version"
              value={formState.version}
              onChange={(e) => setFormState((p) => ({ ...p, version: e.target.value }))}
              placeholder="e.g. 1.21.11"
              required
            />
          </FormRow>

          <div className="sm:col-span-3 space-y-2">
            <FormRow label="Tagline" htmlFor="tagline" error={errors.tagline}>
              <Input
                id="tagline"
                name="tagline"
                value={formState.tagline}
                onChange={(e) => setFormState((p) => ({ ...p, tagline: e.target.value }))}
                placeholder="e.g. Build · Survive · Compete · Create"
              />
            </FormRow>
            {/* Quick-Select Suggestion Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-semibold text-muted mr-1">Quick Select:</span>
              {TAGLINE_SUGGESTIONS.map((preset) => {
                const isSelected = formState.tagline === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormState((p) => ({ ...p, tagline: preset }))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                      isSelected
                        ? "bg-accent text-white shadow-sm ring-1 ring-accent/60"
                        : "bg-surface text-muted hover:bg-line/60 hover:text-ink border border-line"
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sm:col-span-3">
            <FormRow label="Network Description" htmlFor="description" error={errors.description}>
              <textarea
                id="description"
                name="description"
                rows={2}
                value={formState.description}
                onChange={(e) => setFormState((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief summary of the network for headers and meta blurb…"
                className="field w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </FormRow>
          </div>
        </div>

        {actionsFor("identity")}
      </section>

      {/* Social Sharing & Embed Preview Section */}
      <section className="panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-accent-bright" />
            <div>
              <h2 className="font-display text-base font-bold text-ink">Social Sharing &amp; Embed Preview</h2>
              <p className="text-[11px] text-muted font-medium">
                Live OpenGraph card displayed when sharing links on Discord, X (Twitter), Reddit, and messaging apps.
              </p>
            </div>
          </div>
          <span className="cr-tag text-[10px] uppercase font-bold tracking-wider text-accent-bright bg-accent/10 border border-accent/20">
            Live Preview
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Image Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-2">
                Social Share Image (OG Banner)
              </label>

              {/* Mode Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-black/5 dark:bg-white/[0.04] border border-line rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setImageTab("presets")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all",
                    imageTab === "presets"
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  <Sparkles size={13} />
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab("custom")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all",
                    imageTab === "custom"
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  <LinkIcon size={13} />
                  Image URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab("upload")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all",
                    imageTab === "upload"
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  <Upload size={13} />
                  Upload
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Tab 1: Presets */}
              {imageTab === "presets" && (
                <div className="grid grid-cols-2 gap-2.5">
                  {OG_PRESET_IMAGES.map((preset) => {
                    const isSelected = activeOgImage === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setFormState((p) => ({ ...p, ogImageUrl: preset.url }))}
                        className={cn(
                          "group relative flex flex-col text-left rounded-xl border-2 p-2.5 transition-all overflow-hidden",
                          isSelected
                            ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                            : "border-line bg-card/60 hover:border-line-strong hover:bg-card"
                        )}
                      >
                        <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-lg bg-black/20 dark:bg-black/40 border border-line mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="h-full w-full object-contain object-center bg-black/70 p-1 transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          {isSelected && (
                            <span className="absolute top-1.5 right-1.5 bg-accent text-white p-1 rounded-full shadow-md">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-ink truncate">{preset.label}</span>
                        <span className="text-[10px] text-muted truncate mt-0.5">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tab 2: Custom URL */}
              {imageTab === "custom" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/social-banner.webp"
                      value={customInputUrl}
                      onChange={(e) => setCustomInputUrl(e.target.value)}
                      className="text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customInputUrl.trim()) {
                          setFormState((p) => ({ ...p, ogImageUrl: customInputUrl.trim() }));
                          toast("Updated social share banner URL.", "success");
                        }
                      }}
                      className="btn btn-secondary text-xs font-bold shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">
                    Paste any direct image link (.png, .jpg, .webp). Must be a publicly accessible HTTPS URL.
                  </p>
                </div>
              )}

              {/* Tab 3: Upload */}
              {imageTab === "upload" && (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-accent/40 hover:border-accent bg-accent/[0.03] hover:bg-accent/[0.08] rounded-2xl cursor-pointer transition-all text-center group select-none"
                  >
                    <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent-bright mb-2 group-hover:scale-110 transition-transform">
                      <Upload size={18} />
                    </div>
                    <span className="text-xs font-bold text-ink group-hover:text-accent-bright transition-colors">
                      Click to choose an image from your computer
                    </span>
                    <span className="text-[10px] text-muted mt-1 font-medium">
                      PNG, JPG, or WebP up to 2MB (1200×630 recommended)
                    </span>
                  </div>
                  {formState.ogImageUrl && formState.ogImageUrl.startsWith("data:") && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-surface">
                      <div className="flex items-center gap-2 min-w-0">
                        <ImageIcon size={14} className="text-accent-bright shrink-0" />
                        <span className="text-xs text-ink truncate font-medium">Custom uploaded image active in preview</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormState((p) => ({ ...p, ogImageUrl: "/images/og-default.webp" }));
                          toast("Reset to default banner.", "info");
                        }}
                        className="text-[11px] font-bold text-rose-700 dark:text-rose-400 hover:underline shrink-0 ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Helper Note */}
            <div className="rounded-xl border border-line bg-surface p-3 text-[11px] text-muted space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-ink">
                <ImageIcon size={13} className="text-accent-bright" />
                <span>Recommended Dimensions</span>
              </div>
              <p>
                Optimal resolution is <strong>1200 × 630 pixels</strong> (1.91:1 ratio). All Discord and Twitter unfurl bots automatically center-crop to this aspect.
              </p>
            </div>
          </div>

          {/* Right Column: Multi-Platform Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-2">
            {/* Platform Tab Switcher */}
            <div className="flex items-center gap-1 p-1 bg-surface border border-line rounded-xl shadow-inner">
              {[
                { id: "discord" as const, label: "Discord", color: "#5865F2" },
                { id: "twitter" as const, label: "X / Twitter", color: "#1d9bf0" },
                { id: "whatsapp" as const, label: "WhatsApp", color: "#25D366" },
                { id: "facebook" as const, label: "Facebook", color: "#1877f2" },
                { id: "google" as const, label: "Google", color: "#4285f4" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreviewPlatform(p.id)}
                  className={cn(
                    "flex-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center",
                    previewPlatform === p.id
                      ? "text-white shadow-sm"
                      : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  style={previewPlatform === p.id ? { background: p.color } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* === Discord Preview === */}
            {previewPlatform === "discord" && (
              <div className="rounded-2xl border border-[#e3e5e8] dark:border-[#232428] bg-[#f2f3f5] dark:bg-[#2b2d31] p-4 text-[#2e3338] dark:text-[#dbdee1] shadow-lg dark:shadow-2xl font-sans space-y-2 select-none">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded-full bg-purple-600/80 overflow-hidden flex items-center justify-center border border-purple-400/40 shadow-inner shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon.png" alt="Mazora Bot" className="h-full w-full object-contain p-0.5" />
                  </div>
                  <span className="text-xs font-bold text-[#060607] dark:text-white">Mazora Bot</span>
                  <span className="text-[9px] uppercase px-1 py-0.5 bg-[#5865F2] text-white rounded font-extrabold tracking-wider">BOT</span>
                  <span className="text-[10px] text-[#5c5e66] dark:text-[#949ba4] ml-auto">Today at 12:00 PM</span>
                </div>
                <div className="rounded-lg border-l-4 border-[#5865F2] bg-[#ebedef] dark:bg-[#1e1f22] p-3.5 space-y-2 shadow-sm">
                  <div className="text-[11px] font-medium text-[#5c5e66] dark:text-[#949ba4] leading-none">{formState.name || "Mazora Network"}</div>
                  <div className="text-[13px] font-bold text-[#1a0dab] dark:text-[#00a8fc] hover:underline cursor-pointer flex items-center gap-1 leading-snug">
                    <span>{shareTitle}</span>
                    <ExternalLink size={11} className="inline shrink-0 opacity-75" />
                  </div>
                  <p className="text-[11px] text-[#2e3338] dark:text-[#dbdee1] leading-relaxed line-clamp-3">{shareDesc}</p>
                  <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shadow-inner mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeOgImage} alt="Discord Preview" className="h-full w-full object-contain object-center bg-black/70 p-0.5" onError={(e) => { (e.target as HTMLImageElement).src = "/images/og-default.webp"; }} />
                  </div>
                </div>
              </div>
            )}

            {/* === Twitter / X Preview === */}
            {previewPlatform === "twitter" && (
              <div className="rounded-2xl border border-[#cfd9de] dark:border-[#2f3336] bg-white dark:bg-black p-0 shadow-lg dark:shadow-2xl font-sans select-none overflow-hidden">
                <div className="relative aspect-[1200/630] w-full overflow-hidden bg-slate-100 dark:bg-[#16181c]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeOgImage} alt="Twitter Preview" className="h-full w-full object-contain object-center bg-black/70 p-0.5" onError={(e) => { (e.target as HTMLImageElement).src = "/images/og-default.webp"; }} />
                </div>
                <div className="px-3 py-2 border-t border-[#cfd9de] dark:border-[#2f3336] bg-white dark:bg-black">
                  <p className="text-[11px] text-[#536471] dark:text-[#71767b] leading-none">mazora.us</p>
                  <p className="text-[13px] text-[#0f1419] dark:text-[#e7e9ea] font-normal leading-snug mt-0.5 line-clamp-1">{shareTitle}</p>
                  <p className="text-[11px] text-[#536471] dark:text-[#71767b] leading-relaxed mt-0.5 line-clamp-2">{shareDesc}</p>
                </div>
              </div>
            )}

            {/* === WhatsApp Preview === */}
            {previewPlatform === "whatsapp" && (
              <div className="rounded-2xl border border-[#e0dad2] dark:border-transparent bg-[#efeae2] dark:bg-[#0b141a] p-3 shadow-lg dark:shadow-2xl font-sans select-none space-y-1.5">
                {/* Incoming message bubble */}
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white dark:bg-[#202c33] p-0 overflow-hidden shadow-sm dark:shadow-md border border-black/5 dark:border-transparent">
                  <div className="relative aspect-[1200/630] w-full overflow-hidden bg-slate-200 dark:bg-[#111b21]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeOgImage} alt="WhatsApp Preview" className="h-full w-full object-contain object-center bg-black/70 p-0.5" onError={(e) => { (e.target as HTMLImageElement).src = "/images/og-default.webp"; }} />
                  </div>
                  <div className="px-2.5 py-2 space-y-0.5">
                    <p className="text-[10px] text-[#008069] dark:text-[#00a884] font-bold leading-none uppercase tracking-wide">MAZORA.US</p>
                    <p className="text-[12px] text-[#111b21] dark:text-[#e9edef] font-bold leading-snug line-clamp-2">{shareTitle}</p>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696a0] leading-relaxed line-clamp-2">{shareDesc}</p>
                  </div>
                </div>
                <div className="flex items-end gap-1 max-w-[85%]">
                  <div className="rounded-xl rounded-tl-sm bg-white dark:bg-[#202c33] px-2.5 py-1.5 shadow-sm border border-black/5 dark:border-transparent">
                    <p className="text-[12px] text-[#027eb5] dark:text-[#00a884] break-all font-medium">https://mazora.us</p>
                  </div>
                  <span className="text-[9px] text-[#667781] dark:text-[#8696a0] shrink-0 pb-0.5">12:00 PM</span>
                </div>
              </div>
            )}

            {/* === Facebook Preview === */}
            {previewPlatform === "facebook" && (
              <div className="rounded-2xl border border-[#ced0d4] dark:border-[#3e4042] bg-white dark:bg-[#242526] shadow-lg dark:shadow-2xl font-sans select-none overflow-hidden">
                {/* Post Header */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <div className="h-8 w-8 rounded-full bg-purple-600/80 overflow-hidden flex items-center justify-center border border-purple-400/40 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon.png" alt="Page" className="h-full w-full object-contain p-1" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[#050505] dark:text-[#e4e6eb] leading-tight">{formState.name || "Mazora Network"}</p>
                    <p className="text-[10px] text-[#65676b] dark:text-[#b0b3b8] leading-none">Just now · 🌐</p>
                  </div>
                </div>
                <p className="text-[12px] text-[#050505] dark:text-[#e4e6eb] px-3 pb-2">Check out our server! 🎮⚔️</p>
                {/* Link Preview Card */}
                <div className="border-t border-[#ced0d4] dark:border-[#3e4042]">
                  <div className="relative aspect-[1200/630] w-full overflow-hidden bg-slate-100 dark:bg-[#18191a]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeOgImage} alt="Facebook Preview" className="h-full w-full object-contain object-center bg-black/70 p-0.5" onError={(e) => { (e.target as HTMLImageElement).src = "/images/og-default.webp"; }} />
                  </div>
                  <div className="px-3 py-2 bg-[#f0f2f5] dark:bg-[#3a3b3c]">
                    <p className="text-[10px] text-[#65676b] dark:text-[#b0b3b8] uppercase tracking-wide leading-none font-semibold">mazora.us</p>
                    <p className="text-[13px] text-[#050505] dark:text-[#e4e6eb] font-bold leading-snug mt-0.5 line-clamp-2">{shareTitle}</p>
                    <p className="text-[11px] text-[#65676b] dark:text-[#b0b3b8] leading-relaxed mt-0.5 line-clamp-1">{shareDesc}</p>
                  </div>
                </div>
              </div>
            )}

            {/* === Google Search Preview === */}
            {previewPlatform === "google" && (
              <div className="rounded-2xl border border-line bg-card p-4 shadow-2xl font-sans select-none space-y-3">
                {/* Google-style Search Result */}
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full overflow-hidden shrink-0 bg-purple-600 flex items-center justify-center p-0.5 border border-purple-400/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon.png" alt="Favicon" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-[12px] text-ink font-medium leading-tight">{formState.name || "Mazora Network"}</p>
                    <p className="text-[11px] text-muted leading-none">https://mazora.us</p>
                  </div>
                </div>
                <div>
                  <p className="text-[16px] text-blue-600 dark:text-blue-400 font-normal leading-snug cursor-pointer hover:underline">{shareTitle}</p>
                  <p className="text-[12px] text-muted leading-relaxed mt-1 line-clamp-2">{shareDesc}</p>
                </div>
                {/* Rich Result Image Thumbnail */}
                <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-lg border border-line bg-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeOgImage} alt="Google Preview" className="h-full w-full object-contain object-center bg-black/70 p-0.5" onError={(e) => { (e.target as HTMLImageElement).src = "/images/og-default.webp"; }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {actionsFor("sharing")}
      </section>

      {/* Connection Section */}
      <section className="panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Radio size={18} className="text-accent-bright" />
          <h2 className="font-display text-base font-bold text-ink">Connection &amp; Socials</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Java Server IP / Hostname" htmlFor="javaIp" error={errors.javaIp}>
            <Input
              id="javaIp"
              name="javaIp"
              value={formState.javaIp}
              onChange={(e) => setFormState((p) => ({ ...p, javaIp: e.target.value }))}
              placeholder="e.g. mc.mazora.us"
              required
            />
          </FormRow>

          <FormRow label="Bedrock Server IP / Hostname" htmlFor="bedrockIp" error={errors.bedrockIp}>
            <Input
              id="bedrockIp"
              name="bedrockIp"
              value={formState.bedrockIp}
              onChange={(e) => setFormState((p) => ({ ...p, bedrockIp: e.target.value }))}
              placeholder="e.g. mc.mazora.us"
              required
            />
          </FormRow>

          <FormRow label="Bedrock Port" htmlFor="bedrockPort" error={errors.bedrockPort}>
            <Input
              id="bedrockPort"
              name="bedrockPort"
              value={formState.bedrockPort}
              onChange={(e) => setFormState((p) => ({ ...p, bedrockPort: e.target.value }))}
              placeholder="e.g. 25745 or 19132"
              required
            />
          </FormRow>

          <FormRow label="Discord Public Invite URL" htmlFor="discord" error={errors.discord}>
            <Input
              id="discord"
              name="discord"
              value={formState.discord}
              onChange={(e) => setFormState((p) => ({ ...p, discord: e.target.value }))}
              placeholder="e.g. https://discord.gg/ZPrzyGpMyt"
            />
          </FormRow>

          <div className="sm:col-span-2">
            <FormRow label="Discord Support Channel / Ticket Link" htmlFor="discordSupportTickets" error={errors.discordSupportTickets}>
              <Input
                id="discordSupportTickets"
                name="discordSupportTickets"
                value={formState.discordSupportTickets}
                onChange={(e) => setFormState((p) => ({ ...p, discordSupportTickets: e.target.value }))}
                placeholder="e.g. https://discord.com/channels/guild/channel"
              />
            </FormRow>
          </div>
        </div>

        {actionsFor("connection")}
      </section>

      {/* Toggles Section */}
      <section className="panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <ToggleLeft size={18} className="text-accent-bright" />
          <h2 className="font-display text-base font-bold text-ink">System Feature Toggles</h2>
          <span className="ml-auto text-[11px] font-semibold text-muted">
            {savingToggle ? "Saving…" : "Each switch saves as soon as you flip it"}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureToggleCard
            name="maintenanceMode"
            label="Maintenance Mode"
            desc="Show network-wide maintenance notice banner."
            checked={formState.maintenanceMode}
            onChange={(val) => saveToggle("maintenanceMode", val, "Maintenance Mode")}
            disabled={savingToggle || savingSection !== null}
          />
          <FeatureToggleCard
            name="registrationEnabled"
            label="User Registration"
            desc="Allow new players to sign up for web accounts."
            checked={formState.registrationEnabled}
            onChange={(val) => saveToggle("registrationEnabled", val, "User Registration")}
            disabled={savingToggle || savingSection !== null}
          />
          <FeatureToggleCard
            name="storeEnabled"
            label="Storefront &amp; Cart"
            desc="Enable online product purchasing and rank upgrades."
            checked={formState.storeEnabled}
            onChange={(val) => saveToggle("storeEnabled", val, "Storefront & Cart")}
            disabled={savingToggle || savingSection !== null}
          />
          <FeatureToggleCard
            name="suggestionsEnabled"
            label="Suggestions Board"
            desc="Open the public suggestions board. Turn off to show the “coming soon” page instead — existing ideas and replies are kept, just hidden."
            checked={formState.suggestionsEnabled}
            onChange={(val) => saveToggle("suggestionsEnabled", val, "Suggestions Board")}
            disabled={savingToggle || savingSection !== null}
          />
          <FeatureToggleCard
            name="votingEnabled"
            label="Server Voting"
            desc="Allow community voting for daily rewards and bonuses."
            checked={formState.votingEnabled}
            onChange={(val) => saveToggle("votingEnabled", val, "Server Voting")}
            disabled={savingToggle || savingSection !== null}
          />
          <FeatureToggleCard
            name="liveMapEnabled"
            label="Live World Map"
            desc="Embed the Dynmap live map on the homepage. Disable if the map server isn't ready."
            checked={formState.liveMapEnabled}
            onChange={(val) => saveToggle("liveMapEnabled", val, "Live World Map")}
            disabled={savingToggle || savingSection !== null}
          />
        </div>
      </section>
    </div>
  );
}
