"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Crown,
  Gem,
  Layout,
  Package,
  Plus,
  Rocket,
  Save,
  Shield,
  Sparkles,
  Sword,
  Trash2,
  Wand2,
} from "lucide-react";
import type { StoreRoadmapConfig, StoreRoadmapItem } from "@/lib/types";
import type { StoreSettingsActionResult } from "@/lib/actions/store-settings";
import { Input, Textarea, useToast } from "@/components/ui";

const ICON_PRESETS = [
  { label: "Package / Bundle", value: "package", icon: Package },
  { label: "Sword / Weapon", value: "sword", icon: Sword },
  { label: "Sparkles / Pet", value: "sparkles", icon: Sparkles },
  { label: "Wand / Magic", value: "wand", icon: Wand2 },
  { label: "Shield / Armor", value: "shield", icon: Shield },
  { label: "Crown / VIP", value: "crown", icon: Crown },
  { label: "Gem / Crate Key", value: "gem", icon: Gem },
  { label: "Rocket / Booster", value: "rocket", icon: Rocket },
  { label: "Clock / Roadmap", value: "clock", icon: Clock3 },
];

const STATUS_PRESETS = ["Coming Soon", "In Development", "Planned", "In Testing"];

export function renderRoadmapIcon(iconKey: string, size = 16) {
  switch (iconKey.toLowerCase()) {
    case "sword":
    case "swords":
      return <Sword size={size} />;
    case "wand":
    case "magic":
      return <Wand2 size={size} />;
    case "sparkles":
    case "pet":
    case "pets":
      return <Sparkles size={size} />;
    case "shield":
    case "armor":
      return <Shield size={size} />;
    case "crown":
    case "vip":
      return <Crown size={size} />;
    case "gem":
    case "key":
      return <Gem size={size} />;
    case "rocket":
    case "booster":
      return <Rocket size={size} />;
    case "clock":
    case "roadmap":
      return <Clock3 size={size} />;
    default:
      return <Package size={size} />;
  }
}

export function getStatusStyle(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("dev")) {
    return { badge: "border-purple-500/40 bg-purple-500/15 text-purple-300", dot: "bg-purple-400" };
  }
  if (lower.includes("soon")) {
    return { badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" };
  }
  if (lower.includes("plan")) {
    return { badge: "border-amber-500/40 bg-amber-500/15 text-amber-300", dot: "bg-amber-400" };
  }
  if (lower.includes("test")) {
    return { badge: "border-rose-500/40 bg-rose-500/15 text-rose-300", dot: "bg-rose-400" };
  }
  return { badge: "border-violet-500/40 bg-violet-500/15 text-violet-300", dot: "bg-violet-400" };
}

export function StoreRoadmapEditor({
  roadmap,
  saveAction,
}: {
  roadmap: StoreRoadmapConfig;
  saveAction: (formData: FormData) => Promise<StoreSettingsActionResult>;
}) {
  const [eyebrow, setEyebrow] = useState(roadmap.eyebrow);
  const [title, setTitle] = useState(roadmap.title);
  const [subtitle, setSubtitle] = useState(roadmap.subtitle);
  const [enabled, setEnabled] = useState(roadmap.enabled);
  const [items, setItems] = useState<StoreRoadmapItem[]>(roadmap.items);
  const [busy, start] = useTransition();
  const { toast } = useToast();

  function handleAddItem() {
    const newItem: StoreRoadmapItem = {
      id: `item-${Date.now()}`,
      title: "New Future Addon",
      desc: "Teaser description for this upcoming addon feature...",
      status: "Coming Soon",
      icon: "package",
      enabled: true,
    };
    setItems([...items, newItem]);
  }

  function handleUpdateItem(id: string, updates: Partial<StoreRoadmapItem>) {
    setItems(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  function handleDeleteItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  function handleMoveUp(index: number) {
    if (index <= 0) return;
    const newItems = [...items];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;
    setItems(newItems);
  }

  function handleMoveDown(index: number) {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;
    setItems(newItems);
  }

  return (
    <form
      action={(formData) =>
        start(async () => {
          const payload = { eyebrow, title, subtitle, enabled, items };
          formData.set("roadmapJson", JSON.stringify(payload));
          const result = await saveAction(formData);
          toast(result.message, result.ok ? "success" : "error");
        })
      }
      className="store-admin-roadmap cr-board mb-6 overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Sparkles size={13} /> Store merchandising
          </p>
          <h2 className="mt-2 font-display text-xl font-black tracking-tight">Marketplace Roadmap Manager</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Manage the &ldquo;More ways to stand out&rdquo; roadmap section. Reorder card placement, pick icons, select status tags, or toggle visibility.
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-line bg-card/70 px-4 py-2.5 cursor-pointer hover:border-line-strong">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="checkbox checkbox-primary"
          />
          <span className="text-xs font-bold uppercase tracking-wider text-ink">Show Roadmap Section</span>
        </label>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Section Eyebrow</label>
            <Input
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder="e.g. MARKETPLACE ROADMAP"
              className="mt-1.5 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Section Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. More ways to stand out."
              className="mt-1.5 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">Section Subtitle / Description</label>
            <Textarea
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              rows={3}
              placeholder="Sneak peek at upcoming feature bundles..."
              className="mt-1.5 w-full"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted">
              Roadmap Items & Placement Order ({items.length})
            </label>
            <button type="button" onClick={handleAddItem} className="btn btn-secondary btn-xs gap-1.5">
              <Plus size={13} /> Add Feature Card
            </button>
          </div>

          <div className="space-y-3.5 max-h-[26rem] overflow-y-auto pr-1">
            {items.map((item, idx) => {
              return (
                <div key={item.id} className="rounded-xl border border-line bg-card/60 p-3.5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveUp(idx)}
                          className="btn btn-ghost btn-xs p-1 text-muted hover:text-ink disabled:opacity-30"
                          title="Move Up in Order"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => handleMoveDown(idx)}
                          className="btn btn-ghost btn-xs p-1 text-muted hover:text-ink disabled:opacity-30"
                          title="Move Down in Order"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                      <span className="telemetry text-xs text-accent-bright font-mono">Position #{idx + 1}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => handleUpdateItem(item.id, { enabled: e.target.checked })}
                          className="checkbox checkbox-xs checkbox-primary"
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-muted hover:text-rose-400 p-1"
                        title="Delete Card"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[0.65rem] uppercase font-bold text-muted mb-1">Feature Title</label>
                    <Input
                      value={item.title}
                      onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                      placeholder="Feature Title"
                      className="w-full text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[0.65rem] uppercase font-bold text-muted mb-1">Status Selector</label>
                      <select
                        value={STATUS_PRESETS.includes(item.status) ? item.status : "custom"}
                        onChange={(e) => {
                          if (e.target.value !== "custom") {
                            handleUpdateItem(item.id, { status: e.target.value });
                          }
                        }}
                        className="select select-xs w-full text-xs bg-surface border-line"
                      >
                        {STATUS_PRESETS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                        <option value="custom">Custom Status Tag...</option>
                      </select>
                      {!STATUS_PRESETS.includes(item.status) && (
                        <input
                          type="text"
                          value={item.status}
                          onChange={(e) => handleUpdateItem(item.id, { status: e.target.value })}
                          placeholder="Custom Status Tag..."
                          className="input input-xs w-full text-xs mt-1"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[0.65rem] uppercase font-bold text-muted mb-1">Card Icon</label>
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/20 text-violet-300">
                          {renderRoadmapIcon(item.icon, 14)}
                        </div>
                        <select
                          value={item.icon}
                          onChange={(e) => handleUpdateItem(item.id, { icon: e.target.value })}
                          className="select select-xs w-full text-xs bg-surface border-line"
                        >
                          {ICON_PRESETS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[0.65rem] uppercase font-bold text-muted mb-1">Teaser Description</label>
                    <Input
                      value={item.desc}
                      onChange={(e) => handleUpdateItem(item.id, { desc: e.target.value })}
                      placeholder="Short feature description..."
                      className="w-full text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-line p-5 bg-card/20">
        <div className="flex items-center justify-between mb-3">
          <span className="telemetry text-xs uppercase tracking-[0.2em] text-accent-bright flex items-center gap-1.5">
            <Layout size={13} /> Roadmap Live Preview
          </span>
          <span className="text-xs text-muted font-medium">
            {enabled ? `Showing ${items.filter((i) => i.enabled).length} Cards` : "Section Hidden"}
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-surface/90 shadow-2xl p-5 space-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[0.68rem] font-bold text-violet-400 uppercase tracking-wider">
              <Sparkles size={12} /> {eyebrow || "MARKETPLACE ROADMAP"}
            </span>
            <h3 className="text-xl font-black tracking-tight text-ink mt-2">{title || "More ways to stand out."}</h3>
            {subtitle && <p className="text-xs text-muted mt-1 max-w-xl">{subtitle}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {items.filter((i) => i.enabled).map((item) => {
              const statusStyle = getStatusStyle(item.status);
              return (
                <div key={item.id} className="rounded-xl border border-line bg-card/60 p-3.5 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg border border-violet-400/30 bg-violet-500/15 text-violet-300">
                      {renderRoadmapIcon(item.icon, 16)}
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase ${statusStyle.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${statusStyle.dot}`} />
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3">
                    <h4 className="font-bold text-xs text-ink">{item.title}</h4>
                    {item.desc && <p className="text-[0.72rem] text-muted mt-0.5 line-clamp-2">{item.desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
        <p className="text-xs text-muted">Updates take effect immediately across all storefront sessions.</p>
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          <Save size={14} /> {busy ? "Saving…" : "Save Roadmap Settings"}
        </button>
      </div>
    </form>
  );
}
