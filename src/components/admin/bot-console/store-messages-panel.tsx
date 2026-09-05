"use client";

import { useState, useTransition } from "react";
import { Lock, Receipt, Save, Sparkles } from "lucide-react";
import { ConsoleGuide, ConsoleGuideButton, GuideSection } from "@/components/admin/bot-console/console-guide";
import { saveStoreMessagesAction } from "@/lib/actions/store-messages";
import {
  MAX_BLOCK,
  MAX_TITLE,
  PAYMENT_NOTICE,
  buildConfirmedDescription,
  buildDeclinedDescription,
  type StoreMessagesConfig,
} from "@/lib/store-messages-shared";

/** Stand-in values for the preview, shaped like a real order reference. */
const SAMPLE = {
  reference: "MZ-20260904-A1B2C3",
  staff: "KaviYa",
  ticketLink: "https://discord.com/channels/…/…",
  items: "1× Premium Battlepass — $4.50 ($4.50 each)",
  total: "$4.50",
  creatorCode: "AAA1 · −$0.45 (15%) · was $4.95",
};

const TOKEN_HELP: ReadonlyArray<[token: string, meaning: string]> = [
  ["reference", "The order reference, e.g. MZ-20260904-A1B2C3"],
  ["staff", "Who confirmed or declined it"],
  ["ticket_link", "Link to the private ticket (confirmation only)"],
];

function Field({
  label,
  value,
  onChange,
  required,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Tokens this block must keep, surfaced so the save error is never a surprise. */
  required?: string[];
  rows?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
        {required?.map((token) => (
          <code
            key={token}
            className="rounded border border-line bg-card/70 px-1 py-0.5 text-[9px] normal-case tracking-normal"
          >
            {`{${token}}`} required
          </code>
        ))}
      </span>
      <textarea
        value={value}
        rows={rows}
        maxLength={MAX_BLOCK}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full resize-y rounded-xl text-sm"
      />
    </label>
  );
}

function Preview({ title, body, tone }: { title: string; body: string; tone: "ok" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-ink/[0.035] p-3 dark:bg-black/15">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">What the buyer receives</p>
      {/* The coloured left bar mirrors how Discord renders an embed, so the
          preview reads as the message rather than as a form field. */}
      <div
        className={`mt-2 rounded-lg border-l-[3px] bg-card/70 px-3 py-2.5 ${
          tone === "ok" ? "border-l-emerald-500" : "border-l-rose-400"
        }`}
      >
        <p className="text-sm font-bold text-ink">{title || "(no title)"}</p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

export function StoreMessagesPanel({ config }: { config: StoreMessagesConfig }) {
  const [draft, setDraft] = useState<StoreMessagesConfig>(config);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const setConfirmed = (patch: Partial<StoreMessagesConfig["confirmed"]>) =>
    setDraft((current) => ({ ...current, confirmed: { ...current.confirmed, ...patch } }));
  const setDeclined = (patch: Partial<StoreMessagesConfig["declined"]>) =>
    setDraft((current) => ({ ...current, declined: { ...current.declined, ...patch } }));

  const save = () => {
    const data = new FormData();
    data.set("storeMessagesJson", JSON.stringify(draft));
    setMessage(null);
    startTransition(async () => {
      const result = await saveStoreMessagesAction(data);
      setMessage({ ok: result.ok, text: result.message });
    });
  };

  return (
    <section className="panel overflow-hidden p-0">
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent-bright">
            <Receipt size={17} aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-sm font-bold">Store order messages</h2>
            <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-muted">
              Wording for the direct messages a buyer gets when their order is confirmed or declined. Order details and
              the payment warning are added automatically and cannot be edited here.
            </p>
          </div>
        </div>

        {/* Chips only here; what each one means lives in the guide, so the
            header stays a header rather than a reference table. */}
        <div className="flex items-start gap-2 lg:justify-end">
          <div className="flex flex-wrap gap-1.5 lg:max-w-xs lg:justify-end" aria-label="Available message tokens">
            {TOKEN_HELP.map(([token]) => (
              <code key={token} className="rounded-lg border border-line bg-card/70 px-2 py-1 text-[10px] text-muted">
                {`{${token}}`}
              </code>
            ))}
          </div>
          <ConsoleGuideButton label="How store order messages work" onOpen={() => setGuideOpen(true)} />
        </div>
      </header>

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-2">
        <div className="grid gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.03] p-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            <h3 className="font-display text-sm font-bold">Order confirmed</h3>
          </div>

          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Title</span>
            <input
              value={draft.confirmed.title}
              maxLength={MAX_TITLE}
              onChange={(event) => setConfirmed({ title: event.target.value })}
              className="input w-full rounded-xl text-sm"
            />
          </label>

          <Field
            label="Opening"
            value={draft.confirmed.opening}
            required={["reference", "staff"]}
            onChange={(opening) => setConfirmed({ opening })}
          />
          <Field
            label="When a ticket was opened"
            value={draft.confirmed.withTicket}
            required={["ticket_link"]}
            onChange={(withTicket) => setConfirmed({ withTicket })}
          />
          <Field
            label="When no ticket could be opened"
            value={draft.confirmed.withoutTicket}
            onChange={(withoutTicket) => setConfirmed({ withoutTicket })}
          />
          <Field
            label="Automated-bot notice"
            value={draft.confirmed.disclaimer}
            rows={3}
            onChange={(disclaimer) => setConfirmed({ disclaimer })}
          />

          <div className="grid gap-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              Payment warning
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-card/70 px-1.5 py-0.5 text-[9px] normal-case tracking-normal">
                <Lock size={9} aria-hidden /> Locked
              </span>
            </span>
            {/* Not editable anywhere: this is the sentence that protects a buyer
                from someone impersonating staff. */}
            <p className="input w-full break-words rounded-xl text-xs opacity-70">{PAYMENT_NOTICE}</p>
          </div>

          <Preview
            title={draft.confirmed.title}
            tone="ok"
            body={buildConfirmedDescription(
              draft.confirmed,
              {
                reference: SAMPLE.reference,
                staff: SAMPLE.staff,
                ticketLink: SAMPLE.ticketLink,
                items: SAMPLE.items,
                total: SAMPLE.total,
                creatorCode: SAMPLE.creatorCode,
              },
              SAMPLE.ticketLink,
            )}
          />
        </div>

        <div className="grid gap-4 rounded-2xl border border-rose-400/20 bg-rose-500/[0.03] p-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden />
            <h3 className="font-display text-sm font-bold">Order declined</h3>
          </div>

          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Title</span>
            <input
              value={draft.declined.title}
              maxLength={MAX_TITLE}
              onChange={(event) => setDeclined({ title: event.target.value })}
              className="input w-full rounded-xl text-sm"
            />
          </label>

          <Field
            label="Opening"
            value={draft.declined.opening}
            required={["reference", "staff"]}
            onChange={(opening) => setDeclined({ opening })}
          />
          <Field
            label="Closing"
            value={draft.declined.closing}
            rows={3}
            onChange={(closing) => setDeclined({ closing })}
          />
          <Field
            label="Automated-bot notice"
            value={draft.declined.disclaimer}
            rows={3}
            onChange={(disclaimer) => setDeclined({ disclaimer })}
          />

          <Preview
            title={draft.declined.title}
            tone="bad"
            body={buildDeclinedDescription(
              draft.declined,
              { reference: SAMPLE.reference, staff: SAMPLE.staff },
              SAMPLE.ticketLink,
            )}
          />
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t border-line bg-ink/[0.025] px-4 py-4 dark:bg-black/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-[10px] leading-relaxed text-muted sm:max-w-md">
          Order reference, item summary, total, discount code and the payment warning are always added by the bot, in
          that order, whatever you write here. Links cannot be typed into these fields — the support link is added
          automatically.
        </p>
        <button type="button" className="btn btn-primary btn-sm min-w-28 shrink-0" onClick={save} disabled={pending}>
          {pending ? <Sparkles size={14} className="animate-pulse" /> : <Save size={14} />}
          {pending ? "Saving…" : "Save messages"}
        </button>
      </footer>

      {message && (
        <p
          className={`mx-4 mb-4 rounded-xl border px-3 py-2 text-sm sm:mx-6 ${
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
      <ConsoleGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="How store order messages work"
        subtitle="What you can reword, what the bot adds, and why."
      >
        <GuideSection title="Message tokens">
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            These are replaced with the real order&apos;s values when the message is sent. Anything else you type is
            shown exactly as written.
          </p>
          <dl className="mt-3 grid gap-1.5">
            {TOKEN_HELP.map(([token, meaning]) => (
              <div key={token} className="flex flex-wrap items-baseline gap-2">
                <dt>
                  <code className="rounded-lg border border-line bg-card/70 px-2 py-1 text-[10px]">{`{${token}}`}</code>
                </dt>
                <dd className="text-xs text-muted">{meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            The opening lines must keep <code className="text-[10px]">{"{reference}"}</code> and{" "}
            <code className="text-[10px]">{"{staff}"}</code>, and the ticket line must keep{" "}
            <code className="text-[10px]">{"{ticket_link}"}</code>. A buyer who cannot tell which order was declined,
            or by whom, has no way to dispute it — so saving without them is refused.
          </p>
        </GuideSection>

        <GuideSection title="What the bot adds by itself">
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            After your wording, and in this order: the order summary, the total, any discount code, and the payment
            warning. They are appended by the sender rather than typed into your text, which is what stops this panel
            being able to compose a convincing but false receipt.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            The payment warning cannot be edited or removed at all. It is the sentence that separates a real staff
            message from someone impersonating one, so a panel that could quietly delete it would be a way to make a
            scam message look exactly like the genuine article.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            For the same reason, links cannot be typed into any of these fields — not a URL, not an invite, not markdown
            link syntax. The bot appends the real support link itself, so nothing legitimate needs one, and a message
            from the bot about someone&apos;s money is exactly what a fake link would trade on.
          </p>
        </GuideSection>

        <GuideSection title="When each one is sent">
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            The confirmation goes out when staff press Confirm on the order message in Discord; the decline when they
            press Decline. The confirmation uses the ticket line when a private ticket was opened successfully, and the
            other line when one could not be created.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Saving takes effect immediately for orders decided from that point on. Messages already sent are unchanged
            — Discord DMs cannot be rewritten after the fact.
          </p>
        </GuideSection>
      </ConsoleGuide>

    </section>
  );
}
