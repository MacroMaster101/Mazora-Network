"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { Save, RefreshCw, Globe, Radio, ToggleLeft, Check } from "lucide-react";
import { FormRow, Input, useToast } from "@/components/ui";
import type { SiteGeneralSettings } from "@/lib/data/site-settings";
import { saveSiteGeneralSettingsAction } from "@/lib/actions/site-settings";
import { cn } from "@/lib/utils";

function FeatureToggleCard({
  name,
  label,
  desc,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={cn(
        "group relative flex items-center justify-between gap-4 rounded-2xl border-2 p-5 transition-all duration-250 cursor-pointer select-none outline-none",
        checked
          ? "border-purple-500 bg-purple-500/15 shadow-[0_0_24px_rgba(168,85,247,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "border-white/[0.08] bg-white/[0.04] hover:border-white/[0.18] hover:bg-white/[0.07]",
      )}
    >
      <input type="hidden" name={name} value={checked ? "on" : "off"} />

      {/* Subtle glow indicator on the left edge for active toggles */}
      {checked && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]" />
      )}

      <div className="min-w-0 flex-1 pl-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[13px] font-bold text-white group-hover:text-purple-300 transition-colors">
            {label}
          </span>
          <span
            className={cn(
              "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider transition-all inline-flex items-center gap-1",
              checked
                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                : "bg-white/[0.06] text-white/40 border border-white/[0.08]"
            )}
          >
            {checked && <Check size={10} className="stroke-[3]" />}
            {checked ? "Active" : "Off"}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed font-medium">{desc}</p>
      </div>

      {/* Switch track & knob */}
      <div
        className={cn(
          "relative inline-flex h-7 w-[52px] shrink-0 items-center rounded-full transition-all duration-250 ease-in-out border-2",
          checked
            ? "bg-purple-600 border-purple-400 shadow-md shadow-purple-500/40"
            : "bg-white/[0.08] border-white/[0.12] group-hover:border-white/[0.2]"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full shadow-lg transition-all duration-250 ease-in-out",
            checked
              ? "translate-x-[25px] bg-white shadow-purple-300/30"
              : "translate-x-[3px] bg-white/60"
          )}
        />
      </div>
    </div>
  );
}

export function SiteSettingsEditor({
  initialSettings,
  isOwner,
}: {
  initialSettings: SiteGeneralSettings;
  isOwner: boolean;
}) {
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(saveSiteGeneralSettingsAction, null);

  const [formState, setFormState] = useState<SiteGeneralSettings>(initialSettings);

  useEffect(() => {
    if (state?.ok) {
      toast(state.message, "success");
    } else if (state?.message && !state.ok) {
      toast(state.message, "error");
    }
  }, [state, toast]);

  const handleReset = () => {
    setFormState(initialSettings);
    toast("Restored settings to active configuration.", "info");
  };

  return (
    <form action={formAction} className="space-y-6">
      {/* Identity Section */}
      <section className="panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Globe size={18} className="text-accent-bright" />
          <h2 className="font-display text-base font-bold text-ink">Server Identity</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Server Name" htmlFor="name" error={state?.errors?.name}>
            <Input
              id="name"
              name="name"
              value={formState.name}
              onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Mazora Network"
              required
            />
          </FormRow>

          <FormRow label="Short Name / Mark" htmlFor="shortName" error={state?.errors?.shortName}>
            <Input
              id="shortName"
              name="shortName"
              value={formState.shortName}
              onChange={(e) => setFormState((p) => ({ ...p, shortName: e.target.value }))}
              placeholder="e.g. MAZORA"
              required
            />
          </FormRow>

          <FormRow label="Supported Minecraft Version" htmlFor="version" error={state?.errors?.version}>
            <Input
              id="version"
              name="version"
              value={formState.version}
              onChange={(e) => setFormState((p) => ({ ...p, version: e.target.value }))}
              placeholder="e.g. 1.21.11"
              required
            />
          </FormRow>

          <FormRow label="Server Region" htmlFor="region" error={state?.errors?.region}>
            <Input
              id="region"
              name="region"
              value={formState.region}
              onChange={(e) => setFormState((p) => ({ ...p, region: e.target.value }))}
              placeholder="e.g. Asia Pacific"
              required
            />
          </FormRow>

          <div className="sm:col-span-2">
            <FormRow label="Tagline" htmlFor="tagline" error={state?.errors?.tagline}>
              <Input
                id="tagline"
                name="tagline"
                value={formState.tagline}
                onChange={(e) => setFormState((p) => ({ ...p, tagline: e.target.value }))}
                placeholder="e.g. Build. Survive. Compete. Create."
              />
            </FormRow>
          </div>

          <div className="sm:col-span-2">
            <FormRow label="Network Description" htmlFor="description" error={state?.errors?.description}>
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
      </section>

      {/* Connection Section */}
      <section className="panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Radio size={18} className="text-accent-bright" />
          <h2 className="font-display text-base font-bold text-ink">Connection & Socials</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Java Server IP / Hostname" htmlFor="javaIp" error={state?.errors?.javaIp}>
            <Input
              id="javaIp"
              name="javaIp"
              value={formState.javaIp}
              onChange={(e) => setFormState((p) => ({ ...p, javaIp: e.target.value }))}
              placeholder="e.g. mc.mazora.us"
              required
            />
          </FormRow>

          <FormRow label="Bedrock Server IP / Hostname" htmlFor="bedrockIp" error={state?.errors?.bedrockIp}>
            <Input
              id="bedrockIp"
              name="bedrockIp"
              value={formState.bedrockIp}
              onChange={(e) => setFormState((p) => ({ ...p, bedrockIp: e.target.value }))}
              placeholder="e.g. mc.mazora.us"
              required
            />
          </FormRow>

          <FormRow label="Bedrock Port" htmlFor="bedrockPort" error={state?.errors?.bedrockPort}>
            <Input
              id="bedrockPort"
              name="bedrockPort"
              value={formState.bedrockPort}
              onChange={(e) => setFormState((p) => ({ ...p, bedrockPort: e.target.value }))}
              placeholder="e.g. 25745 or 19132"
              required
            />
          </FormRow>

          <FormRow label="Discord Public Invite URL" htmlFor="discord" error={state?.errors?.discord}>
            <Input
              id="discord"
              name="discord"
              value={formState.discord}
              onChange={(e) => setFormState((p) => ({ ...p, discord: e.target.value }))}
              placeholder="e.g. https://discord.gg/ZPrzyGpMyt"
            />
          </FormRow>

          <div className="sm:col-span-2">
            <FormRow label="Discord Support Channel / Ticket Link" htmlFor="discordSupportTickets" error={state?.errors?.discordSupportTickets}>
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
      </section>

      {/* Toggles Section */}
      <section className="panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <ToggleLeft size={18} className="text-accent-bright" />
          <h2 className="font-display text-base font-bold text-ink">System Feature Toggles</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureToggleCard
            name="maintenanceMode"
            label="Maintenance Mode"
            desc="Show network-wide maintenance notice banner."
            checked={formState.maintenanceMode}
            onChange={(val) => setFormState((p) => ({ ...p, maintenanceMode: val }))}
          />
          <FeatureToggleCard
            name="registrationEnabled"
            label="User Registration"
            desc="Allow new players to sign up for web accounts."
            checked={formState.registrationEnabled}
            onChange={(val) => setFormState((p) => ({ ...p, registrationEnabled: val }))}
          />
          <FeatureToggleCard
            name="storeEnabled"
            label="Storefront & Cart"
            desc="Enable online product purchasing and rank upgrades."
            checked={formState.storeEnabled}
            onChange={(val) => setFormState((p) => ({ ...p, storeEnabled: val }))}
          />
          <FeatureToggleCard
            name="votingEnabled"
            label="Server Voting"
            desc="Allow community voting for daily rewards and bonuses."
            checked={formState.votingEnabled}
            onChange={(val) => setFormState((p) => ({ ...p, votingEnabled: val }))}
          />
        </div>
      </section>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="btn btn-ghost btn-sm flex items-center gap-1.5 text-muted hover:text-ink"
        >
          <RefreshCw size={14} />
          Reset Changes
        </button>

        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary btn-sm flex items-center gap-2 min-w-[140px] justify-center shadow-lg shadow-purple-500/25"
        >
          {isPending ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Saving Settings…
            </>
          ) : (
            <>
              <Save size={14} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
