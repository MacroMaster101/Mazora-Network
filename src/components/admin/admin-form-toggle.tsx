"use client";

import { useState } from "react";
import { Check, ExternalLink, Gavel, Save, ShieldCheck, Video, Ban } from "lucide-react";
import { toggleFormStatusAction, updateFormUrlAction } from "@/lib/actions/forms-admin";
import type { FormConfigItem } from "@/lib/data/forms-config";

const iconMap = {
  appeals: Gavel,
  staff: ShieldCheck,
  creator: Video,
};

interface AdminFormToggleProps {
  config: FormConfigItem;
  iconName: "appeals" | "staff" | "creator";
}

export function AdminFormToggleCard({ config, iconName }: AdminFormToggleProps) {
  const Icon = iconMap[iconName] ?? Gavel;
  const [enabled, setEnabled] = useState(config.enabled);
  const [url, setUrl] = useState(config.publicUrl);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleToggle() {
    setLoadingToggle(true);
    const nextState = !enabled;
    setEnabled(nextState);
    const res = await toggleFormStatusAction(config.id, nextState);
    if (!res.ok) {
      setEnabled(enabled);
    }
    setLoadingToggle(false);
  }

  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setSavingUrl(true);
    setErrorMsg("");
    setSavedSuccess(false);

    const res = await updateFormUrlAction(config.id, url.trim());
    if (res.ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setErrorMsg(res.message || "Failed to update URL");
    }
    setSavingUrl(false);
  }

  return (
    <article
      className={`panel relative flex flex-col justify-between p-6 rounded-2xl border backdrop-blur-xl shadow-lg transition-all duration-300 ${
        enabled
          ? "bg-card/95 border-line hover:border-accent/40"
          : "bg-card/60 border-red-500/25 hover:border-red-500/40"
      }`}
    >
      {/* ── Disabled overlay stripe ── */}
      {!enabled && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
          <div className="absolute -top-1 -right-1 px-3 py-0.5 rounded-bl-xl bg-red-500/90 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
            Paused
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-300 ${
                enabled
                  ? "bg-accent/15 text-accent-bright border-accent/25"
                  : "bg-red-500/10 text-red-400/60 border-red-500/20"
              }`}
            >
              {enabled ? <Icon size={20} /> : <Ban size={20} />}
            </span>
            <div>
              <span
                className={`eyebrow block text-[11px] uppercase tracking-wider transition-colors duration-300 ${
                  enabled ? "" : "text-muted/60"
                }`}
              >
                {config.category}
              </span>
              <h3
                className={`font-display text-base font-bold leading-tight transition-colors duration-300 ${
                  enabled ? "text-ink" : "text-muted"
                }`}
              >
                {config.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            disabled={loadingToggle}
            aria-label={`Toggle ${config.title}`}
            className={`group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? "bg-accent" : "bg-red-500/40"
            } ${loadingToggle ? "opacity-50 cursor-wait" : ""}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all duration-300 ${
              enabled
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : "bg-red-500/10 border-red-500/25 text-red-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                enabled ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            {enabled ? "Publicly Active" : "Intake Paused"}
          </span>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={`text-xs hover:underline inline-flex items-center gap-1 font-medium transition-colors ${
                enabled
                  ? "text-accent-bright"
                  : "text-muted/50"
              }`}
              title="Preview form link in new tab"
            >
              Test Link <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Disabled warning message */}
        {!enabled && (
          <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-2.5">
            <Ban size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300/80 font-medium leading-relaxed">
              This form is currently hidden from public pages. Users visiting the page will see a &ldquo;Paused&rdquo; message and the form link will be disabled.
            </p>
          </div>
        )}
      </div>

      <div
        className={`pt-4 border-t transition-colors duration-300 ${
          enabled ? "border-line/60" : "border-red-500/15"
        }`}
      >
        <form onSubmit={handleSaveUrl} className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor={`form-url-${config.id}`} className="block text-xs font-bold uppercase tracking-wider text-ink">
              🔗 Form Link URL
            </label>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-accent-bright hover:underline inline-flex items-center gap-1"
                title="Test and preview form link in new tab"
              >
                Test Form Link <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id={`form-url-${config.id}`}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. https://forms.gle/your-form-link"
              required
              className="min-w-0 flex-1 px-3 py-2 text-xs rounded-xl bg-surface border border-line-strong/60 focus:border-accent text-ink font-mono font-medium focus:outline-none transition-colors shadow-2xs"
            />
            <button
              type="submit"
              disabled={savingUrl || !url.trim()}
              className={`btn btn-sm text-xs font-bold px-4 shrink-0 flex items-center gap-1.5 transition-all shadow-xs ${
                savedSuccess
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "btn-gold"
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check size={14} /> Saved Live
                </>
              ) : (
                <>
                  <Save size={14} /> {savingUrl ? "Saving..." : "Save Link"}
                </>
              )}
            </button>
          </div>
          {errorMsg && <p className="text-[11px] text-red-400 mt-1 font-semibold">{errorMsg}</p>}
        </form>
      </div>
    </article>
  );
}
