"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  Clock,
  Edit2,
  Gift,
  Globe,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import type { AdminVoteSite } from "@/lib/data/voting";
import {
  saveVoteSiteAction,
  toggleVoteSiteAction,
  deleteVoteSiteAction,
} from "@/lib/actions/voting-admin";
import { useToast } from "@/components/ui";

export function VotingSitesEditor({ sites }: { sites: AdminVoteSite[] }) {
  const [siteList, setSiteList] = useState<AdminVoteSite[]>(sites);
  const [editingSite, setEditingSite] = useState<AdminVoteSite | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  async function handleToggle(site: AdminVoteSite) {
    const nextState = !site.enabled;
    setSiteList((prev) =>
      prev.map((s) => (s.id === site.id ? { ...s, enabled: nextState } : s))
    );

    startTransition(async () => {
      const res = await toggleVoteSiteAction(site.id, nextState);
      toast(res.message || "Updated", res.ok ? "success" : "error");
      if (!res.ok) {
        setSiteList((prev) =>
          prev.map((s) => (s.id === site.id ? { ...s, enabled: site.enabled } : s))
        );
      }
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    setSiteList((prev) => prev.filter((s) => s.id !== id));

    startTransition(async () => {
      const res = await deleteVoteSiteAction(id);
      toast(res.message || "Deleted", res.ok ? "success" : "error");
      if (!res.ok) {
        // Refresh site list if delete failed
        setSiteList(sites);
      }
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await saveVoteSiteAction(formData);
      toast(res.message || "Saved", res.ok ? "success" : "error");
      if (res.ok) {
        setEditingSite(null);
        setIsCreating(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Vote Partner Listings</h2>
          <p className="text-xs text-muted font-medium">
            Manage vote sites, reward descriptions, cooldowns, and active status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingSite(null);
            setIsCreating(true);
          }}
          className="btn btn-primary btn-sm flex items-center gap-2 font-bold"
        >
          <Plus size={16} /> Add Vote Site
        </button>
      </div>

      {/* Edit / Create Form Modal */}
      {(isCreating || editingSite) && (
        <div className="panel p-6 rounded-2xl border border-accent/40 bg-card/98 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <h3 className="font-display text-base font-bold text-ink">
              {editingSite ? `Edit "${editingSite.name}"` : "Add New Vote Site"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingSite(null);
              }}
              className="text-muted hover:text-ink transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {editingSite && <input type="hidden" name="id" value={editingSite.id} />}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Site Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingSite?.name || ""}
                  placeholder="e.g. Minecraft MP"
                  className="w-full h-10 px-3 rounded-xl border border-line bg-surface text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Site URL *
                </label>
                <input
                  type="url"
                  name="url"
                  required
                  defaultValue={editingSite?.url || ""}
                  placeholder="https://minecraft-mp.com/vote/..."
                  className="w-full h-10 px-3 rounded-xl border border-line bg-surface text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  In-Game Reward Description
                </label>
                <input
                  type="text"
                  name="rewardDescription"
                  defaultValue={editingSite?.rewardDescription || editingSite?.reward || ""}
                  placeholder="e.g. 1x Vote Key & $500 Coins"
                  className="w-full h-10 px-3 rounded-xl border border-line bg-surface text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Cooldown (Hours)
                </label>
                <input
                  type="number"
                  name="cooldownHours"
                  min="1"
                  max="168"
                  defaultValue={editingSite?.cooldownHours || 24}
                  className="w-full h-10 px-3 rounded-xl border border-line bg-surface text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={editingSite ? editingSite.enabled : true}
                  className="rounded border-line bg-surface text-accent focus:ring-accent"
                />
                Enable Site Publicly
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingSite(null);
                }}
                className="btn btn-ghost btn-sm text-muted hover:text-ink font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary btn-sm font-bold"
              >
                {pending ? "Saving..." : editingSite ? "Save Changes" : "Create Vote Site"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sites List Grid */}
      <div className="grid gap-4">
        {siteList.map((site) => (
          <div
            key={site.id}
            className="panel p-5 rounded-2xl border border-line bg-card/95 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-accent/40"
          >
            <div className="flex items-start gap-4 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-bright border border-accent/25">
                <Globe size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-display text-base font-bold text-ink truncate">{site.name}</h3>
                  <span
                    className={`telemetry text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${
                      site.enabled
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                        : "bg-surface border-line text-muted"
                    }`}
                  >
                    {site.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted font-medium">
                  {site.reward && (
                    <span className="flex items-center gap-1">
                      <Gift size={13} className="text-accent-bright" /> {site.reward}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={13} /> {site.cooldownHours}h cooldown
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={site.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-xs border border-line hover:border-accent/40 p-2 text-muted hover:text-ink rounded-lg"
                title="Open site"
              >
                <ArrowUpRight size={14} />
              </a>

              <button
                type="button"
                onClick={() => handleToggle(site)}
                disabled={pending}
                className={`btn btn-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all ${
                  site.enabled
                    ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40"
                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40"
                }`}
                title={site.enabled ? "Disable site" : "Enable site"}
              >
                <Power size={13} />
                {site.enabled ? "Disable" : "Enable"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingSite(site);
                }}
                className="btn btn-ghost btn-xs border border-line hover:border-accent/40 p-2 text-muted hover:text-ink rounded-lg"
                title="Edit site"
              >
                <Edit2 size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(site.id, site.name)}
                disabled={pending}
                className="btn btn-ghost btn-xs border border-line hover:border-rose-500/40 p-2 text-rose-400 hover:text-rose-300 rounded-lg"
                title="Delete site"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {siteList.length === 0 && (
          <div className="panel p-10 text-center rounded-2xl border border-line bg-card/50">
            <p className="text-sm text-muted font-medium">No vote sites configured yet.</p>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="btn btn-primary btn-sm mt-3 font-bold"
            >
              <Plus size={16} /> Add First Vote Site
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
