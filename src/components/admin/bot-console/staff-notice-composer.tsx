"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Search, Send, ShieldAlert, UserRound, X } from "lucide-react";
import { searchDiscordMembers, sendStaffNotice } from "@/lib/actions/staff-notices";
import type { GuildMemberMatch } from "@/lib/discord";
import {
  MAX_REASON_LENGTH,
  renderStaffNotice,
  SUGGESTED_REASONS,
  templateMentionsStaffTeam,
  type StaffNoticeTemplate,
} from "@/lib/staff-notices";

const TEMPLATE_LABELS: Record<StaffNoticeTemplate, string> = {
  warning: "Warning",
  custom: "Custom message",
  promotion: "Promotion",
  terminated: "Termination",
};

/** Warning and Custom first: they are the ones that may go to anyone. */
const TEMPLATE_ORDER: StaffNoticeTemplate[] = ["warning", "custom", "promotion", "terminated"];

/**
 * Render Discord's `**bold**` the way the recipient will see it.
 *
 * The payload really does contain the asterisks, but showing them raw makes the
 * preview a preview of the JSON rather than of the message. Bold is the only
 * markup these templates emit, so this stays deliberately tiny rather than
 * pulling in a markdown parser.
 */
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, index) =>
    chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4 ? (
      <strong key={index} className="font-semibold text-ink">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      chunk
    ),
  );
}

function Avatar({ member, size }: { member: GuildMemberMatch; size: number }) {
  if (member.avatarUrl) {
    return (
      <Image
        src={member.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-accent/20 text-xs font-semibold uppercase"
      style={{ width: size, height: size }}
    >
      {member.username.slice(0, 1)}
    </span>
  );
}

export function StaffNoticeComposer({ canTerminate }: { canTerminate: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuildMemberMatch[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [target, setTarget] = useState<GuildMemberMatch | null>(null);

  const [template, setTemplate] = useState<StaffNoticeTemplate>("warning");
  const [reason, setReason] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [searching, setSearching] = useState(false);
  const [sending, startSend] = useTransition();

  const titleNeeded = template === "custom" && !customTitle.trim();
  const ready = target !== null && reason.trim().length > 0 && !titleNeeded;

  /**
   * Sequence guard for out-of-order responses.
   *
   * Typing "kas" fires a request per debounced keystroke, and there is no
   * guarantee the reply to "kas" arrives after the reply to "ka". Without this,
   * a slow earlier request can land last and overwrite the correct results with
   * stale ones. Only the newest request is allowed to write state.
   */
  const searchSeq = useRef(0);

  // Search as the operator types. 300ms is long enough that a normal typing
  // burst collapses into one request, short enough to feel immediate.
  useEffect(() => {
    if (target) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      searchSeq.current += 1; // invalidate anything in flight
      setResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const outcome = await searchDiscordMembers(trimmed);
      if (seq !== searchSeq.current) return; // a newer keystroke won
      setSearching(false);
      if (outcome.ok) {
        setResults(outcome.members);
        setSearchError(null);
      } else {
        setResults(null);
        setSearchError(outcome.message);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, target]);

  // Rendered with the same pure function the server sends, so what is approved
  // here is exactly what the recipient receives.
  const previewEmbed = target
    ? ((
        renderStaffNotice({
          template,
          username: target.displayName ?? target.username,
          reason: reason.trim() || "…",
          customTitle,
        }).embeds as Record<string, unknown>[]
      )[0] as { title: string; description: string; color: number })
    : null;

  function submit() {
    if (!target) return;
    startSend(async () => {
      const outcome = await sendStaffNotice({
        discordUserId: target.id,
        template,
        reason,
        customTitle,
      });
      setResult(outcome);
      setConfirming(false);
      if (outcome.ok) {
        setReason("");
        setCustomTitle("");
      }
    });
  }

  return (
    <section className="panel p-6">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold">Message a Discord member</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Sends a direct message from the Mazora bot. This does not change anyone&apos;s rank — use
          Users for that.
        </p>
      </header>

      <div className="grid gap-5">
        {/* ---------- 1. Recipient ---------- */}
        <div className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            1 · Recipient
          </span>

          {target ? (
            <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
              <Avatar member={target} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {target.displayName ?? target.username}
                </span>
                <span className="block truncate text-xs text-muted">@{target.username}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setTarget(null);
                  setResult(null);
                }}
              >
                <X size={14} /> Change
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <input
                  className="input w-full pl-9 pr-9"
                  value={query}
                  placeholder="Start typing a username or nickname"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Search Discord members"
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query.trim().length >= 2 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {searching ? (
                      <Loader2 size={15} className="animate-spin text-muted" aria-label="Searching" />
                    ) : (
                      <button
                        type="button"
                        aria-label="Clear search"
                        className="text-muted transition-colors hover:text-ink"
                        onClick={() => setQuery("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                Results appear as you type. Matches the <strong>start</strong> of a username or
                nickname — if a full name finds nothing, each word is tried separately.
              </p>

              {searchError && <p className="text-sm text-amber-400">{searchError}</p>}

              {results !== null && results.length === 0 && !searchError && (
                <p className="text-sm text-muted">
                  Nobody in the server matches that. Try the first few letters of their name.
                </p>
              )}

              {/*
                Results are deliberately NOT cleared when a new search starts:
                flickering to empty between keystrokes is worse than briefly
                showing the previous matches. Dimming makes that staleness
                visible rather than silent.
              */}
              {results !== null && results.length > 0 && (
                <ul
                  className={`grid max-h-64 gap-0.5 overflow-y-auto rounded-xl border border-line p-1 transition-opacity ${
                    searching ? "opacity-50" : "opacity-100"
                  }`}
                >
                  {results.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent/10"
                        onClick={() => {
                          setTarget(member);
                          setResults(null);
                          setQuery("");
                        }}
                      >
                        <Avatar member={member} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {member.displayName ?? member.username}
                          </span>
                          {member.displayName && (
                            <span className="block truncate text-[11px] text-muted">
                              @{member.username}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ---------- 2. Message ---------- */}
        <div className="grid gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            2 · Message
          </span>

          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_ORDER.filter((key) => key !== "terminated" || canTerminate).map((key) => {
              const active = key === template;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent/20 text-ink"
                      : "border-line text-muted hover:bg-ink/[0.06]"
                  }`}
                  onClick={() => {
                    setTemplate(key);
                    setResult(null);
                  }}
                >
                  {TEMPLATE_LABELS[key]}
                </button>
              );
            })}
          </div>

          {templateMentionsStaffTeam(template) && (
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-400">
              <ShieldAlert size={13} className="mt-px shrink-0" />
              This wording refers to the staff team. It sends to anyone — check the preview reads
              correctly for this recipient.
            </p>
          )}

          {template === "custom" && (
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Title</span>
              <input
                className="input"
                value={customTitle}
                maxLength={120}
                placeholder="What is this message about?"
                onChange={(event) => setCustomTitle(event.target.value)}
              />
            </label>
          )}

          <div className="grid gap-1.5">
            <span className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Reason</span>
              <span className="text-[11px] text-muted">
                {reason.length}/{MAX_REASON_LENGTH}
              </span>
            </span>
            <textarea
              className="input min-h-24"
              value={reason}
              maxLength={MAX_REASON_LENGTH}
              placeholder="Explain why, in your own words. The recipient sees this exactly as typed."
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted">Suggestions:</span>
              {SUGGESTED_REASONS[template].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  title={suggestion}
                  className="max-w-56 truncate rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
                  onClick={() => setReason(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- 3. Preview & send ---------- */}
        {previewEmbed && (
          <div className="grid gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              3 · Preview
            </span>
            <div className="flex gap-0 overflow-hidden rounded-lg bg-ink/[0.04]">
              <span
                className="w-1 shrink-0"
                style={{ backgroundColor: `#${previewEmbed.color.toString(16).padStart(6, "0")}` }}
                aria-hidden
              />
              <div className="min-w-0 p-3">
                <p className="text-sm font-semibold">{previewEmbed.title}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
                  {renderBold(previewEmbed.description)}
                </p>
                <p className="mt-2 text-[10px] text-muted">Mazora Network</p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              result.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {result.message}
          </p>
        )}

        {!confirming ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!ready || sending}
            onClick={() => setConfirming(true)}
          >
            <Send size={15} /> Review and send
          </button>
        ) : (
          <div className="grid gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
            <p className="flex items-center gap-2 text-sm">
              <UserRound size={15} className="shrink-0" />
              Send this {TEMPLATE_LABELS[template].toLowerCase()} to{" "}
              <strong>{target?.displayName ?? target?.username}</strong>?
            </p>
            <p className="text-[11px] text-muted">
              Discord messages cannot be recalled once delivered.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={sending} onClick={submit}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? "Sending…" : "Yes, send it"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
