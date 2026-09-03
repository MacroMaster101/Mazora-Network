"use client";

import { useState, useTransition, type ComponentType } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  Globe2,
  Pickaxe,
  Plus,
  Save,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { saveBotPresenceAction } from "@/lib/actions/bot-presence";
import {
  ACTIVITY_TYPES,
  MAX_ROTATE_MS,
  MIN_ROTATE_MS,
  type BotPresenceConfig,
  type PresenceStatusRow,
} from "@/lib/bot-presence-config-shared";
import { resolveStatusText, type PresenceTokens } from "@/lib/presence-template";

const TOKENS = ["site_status", "mc_players", "mc_max", "discord_online", "discord_members"];

const KIND_META: Record<
  PresenceStatusRow["kind"],
  {
    title: string;
    description: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    iconClass: string;
    glowClass: string;
  }
> = {
  website: {
    title: "Website",
    description: "Mazora site availability",
    icon: Globe2,
    iconClass: "border-sky-400/30 bg-sky-500/10 text-sky-500",
    glowClass: "from-sky-500/50",
  },
  minecraft: {
    title: "Minecraft",
    description: "Live player population",
    icon: Pickaxe,
    iconClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-500",
    glowClass: "from-emerald-500/50",
  },
  discord: {
    title: "Discord",
    description: "Community activity",
    icon: UsersRound,
    iconClass: "border-violet-400/30 bg-violet-500/10 text-violet-500",
    glowClass: "from-violet-500/50",
  },
  custom: {
    title: "Custom status",
    description: "Your own rotating message",
    icon: Sparkles,
    iconClass: "border-amber-400/30 bg-amber-500/10 text-amber-500",
    glowClass: "from-amber-500/50",
  },
};

const DISCORD_TEMPLATES = {
  online: "🟣 Discord • {discord_online} online",
  members: "🟣 Discord • {discord_online} online ({discord_members} members)",
} as const;

export function PresenceEditorPanel({
  config,
  tokens,
}: {
  config: BotPresenceConfig;
  tokens: PresenceTokens;
}) {
  const [rows, setRows] = useState<PresenceStatusRow[]>(config.statuses);
  const [rotateMs, setRotateMs] = useState(config.rotateMs);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (id: string, patch: Partial<PresenceStatusRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const move = (index: number, delta: number) =>
    setRows((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addCustom = () =>
    setRows((current) => [
      ...current,
      {
        id: `custom-${crypto.randomUUID()}`,
        kind: "custom",
        template: "🎉 A new adventure is waiting",
        fallbackTemplate: null,
        activityType: "Playing",
        enabled: true,
      },
    ]);

  const save = () => {
    const data = new FormData();
    data.set("botPresenceJson", JSON.stringify({ statuses: rows, rotateMs, refreshMs: config.refreshMs }));
    setMessage(null);
    startTransition(async () => {
      const result = await saveBotPresenceAction(data);
      setMessage({ ok: result.ok, text: result.message });
    });
  };

  const enabledCount = rows.filter((row) => row.enabled).length;

  return (
    <section className="panel overflow-hidden p-0">
      <header className="relative overflow-hidden border-b border-line px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-bright shadow-sm">
              <Bot size={21} aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold">Presence rotation</h2>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                  {enabledCount} active
                </span>
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
                Build the status loop players see in Discord. Reorder the cards and preview every line before saving.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 lg:max-w-md lg:justify-end" aria-label="Available template tokens">
            {TOKENS.map((token) => (
              <code key={token} className="rounded-lg border border-line bg-card/70 px-2 py-1 text-[10px] text-muted">
                {`{${token}}`}
              </code>
            ))}
          </div>
        </div>
      </header>

      <ol className="grid gap-4 p-4 sm:p-6">
        {rows.map((row, index) => {
          const preview = resolveStatusText(row, tokens);
          const meta = KIND_META[row.kind];
          const Icon = meta.icon;
          const label = row.kind === "custom" ? `custom status ${index + 1}` : `${row.kind} status`;
          const discordMode = row.kind === "discord" && row.template.includes("{discord_members}") ? "members" : "online";

          return (
            <li
              key={row.id}
              className={`relative overflow-hidden rounded-2xl border bg-card/55 shadow-sm transition-all duration-200 ${
                row.enabled ? "border-line hover:border-accent/30 hover:shadow-md" : "border-line opacity-65"
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${meta.glowClass} via-transparent to-transparent`} />

              <div className="grid gap-5 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.iconClass}`}>
                      <Icon size={18} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-sm font-bold">{meta.title}</h3>
                        <span className="rounded-md bg-ink/[0.05] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted dark:bg-white/[0.06]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{meta.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card/70 px-3 py-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        className="peer sr-only"
                        aria-label={`Enable ${label}`}
                        onChange={(event) => update(row.id, { enabled: event.target.checked })}
                      />
                      <span className="relative h-5 w-9 rounded-full bg-ink/15 transition-colors peer-checked:bg-accent dark:bg-white/15">
                        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                      </span>
                      {row.enabled ? "Active" : "Paused"}
                    </label>

                    <label className="relative">
                      <span className="sr-only">Activity type for {label}</span>
                      <select
                        value={row.activityType}
                        onChange={(event) =>
                          update(row.id, { activityType: event.target.value as PresenceStatusRow["activityType"] })
                        }
                        className="input min-h-9 appearance-none rounded-xl py-2 pl-3 pr-8 text-xs font-semibold"
                        aria-label={`Activity type for ${label}`}
                      >
                        {ACTIVITY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" size={13} aria-hidden />
                    </label>

                    <div className="flex rounded-xl border border-line bg-card/70 p-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-accent/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                        disabled={index === 0}
                        aria-label={`Move ${label} up`}
                        onClick={() => move(index, -1)}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-accent/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                        disabled={index === rows.length - 1}
                        aria-label={`Move ${label} down`}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>

                    {row.kind === "custom" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-rose-500"
                        aria-label={`Remove ${label}`}
                        onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {row.kind === "discord" && (
                  <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.05] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Discord count style</p>
                      <span className="text-[10px] text-muted">Choose how much detail appears</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:inline-grid sm:min-w-[360px]">
                      {([
                        ["online", "Online only", "85 online"],
                        ["members", "Online + members", "85 online · 645 members"],
                      ] as const).map(([mode, title, example]) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={discordMode === mode}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            discordMode === mode
                              ? "border-violet-400/50 bg-violet-500/15 text-ink shadow-sm"
                              : "border-line bg-card/60 text-muted hover:border-violet-400/30 hover:text-ink"
                          }`}
                          onClick={() => update(row.id, { template: DISCORD_TEMPLATES[mode] })}
                        >
                          <span className="block text-xs font-bold">{title}</span>
                          <span className="mt-0.5 block text-[10px] opacity-75">{example}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`grid gap-4 ${row.kind === "custom" ? "" : "lg:grid-cols-2"}`}>
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Status message</span>
                    <input
                      value={row.template}
                      maxLength={128}
                      spellCheck={false}
                      onChange={(event) => update(row.id, { template: event.target.value })}
                      className="input w-full rounded-xl font-mono text-sm"
                      aria-label={`${label} text`}
                    />
                  </label>

                  {row.kind !== "custom" && (
                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Fallback message</span>
                      <input
                        value={row.fallbackTemplate ?? ""}
                        maxLength={128}
                        spellCheck={false}
                        onChange={(event) => update(row.id, { fallbackTemplate: event.target.value || null })}
                        className="input w-full rounded-xl font-mono text-sm"
                        placeholder="Shown when live data is unavailable"
                        aria-label={`${label} fallback text`}
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-line bg-ink/[0.035] p-3 dark:bg-black/15">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-bright">
                    <Eye size={14} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Live preview</p>
                    <p className="mt-1 break-words font-mono text-xs font-semibold text-ink">
                      {preview ?? "This status will be skipped until live data is available."}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="border-t border-line bg-ink/[0.025] px-4 py-4 dark:bg-black/10 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addCustom}
              disabled={rows.length >= 20}
            >
              <Plus size={14} /> Add custom status
            </button>

            <label className="flex items-center gap-2 rounded-xl border border-line bg-card/70 px-3 py-2 text-xs font-semibold">
              <Clock3 size={14} className="text-accent-bright" aria-hidden />
              Rotate every
              <input
                type="number"
                min={MIN_ROTATE_MS / 1000}
                max={MAX_ROTATE_MS / 1000}
                value={rotateMs / 1000}
                onChange={(event) => {
                  const seconds = event.target.valueAsNumber;
                  if (Number.isFinite(seconds)) {
                    setRotateMs(Math.min(MAX_ROTATE_MS, Math.max(MIN_ROTATE_MS, seconds * 1000)));
                  }
                }}
                className="input h-8 w-16 rounded-lg px-2 text-center text-xs"
                aria-label="Rotate every seconds"
              />
              seconds
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-[10px] leading-relaxed text-muted sm:max-w-xs sm:text-right">
              {MIN_ROTATE_MS / 1000}s is the safe minimum for Discord&apos;s presence limit.
            </p>
            <button type="button" className="btn btn-primary btn-sm min-w-28" onClick={save} disabled={pending}>
              {pending ? <Sparkles size={14} className="animate-pulse" /> : <Save size={14} />}
              {pending ? "Saving…" : "Save rotation"}
            </button>
          </div>
        </div>

        {message && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
              message.ok
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-500"
                : "border-amber-400/25 bg-amber-500/10 text-amber-500"
            }`}
            role="status"
            aria-live="polite"
          >
            {message.text}
          </p>
        )}
      </footer>
    </section>
  );
}
