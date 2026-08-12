"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, FilePlus2, Save } from "lucide-react";
import type { SupportCardSettings, SupportPageDetails } from "@/lib/data/support-settings";
import type { SupportSettingsResult } from "@/lib/actions/support-settings";
import { Input, Textarea, useToast } from "@/components/ui";

const newPage = (title: string): SupportPageDetails => ({ eyebrow: "Support", title, lead: "Explain how players should use this Support option.", ticketType: "support", details: ["Add the first required detail."], privacyNote: "Add a privacy or safety note." });
const EYEBROW_OPTIONS = ["Direct Help", "Support & Moderation", "Join the Crew", "Creator Program", "Safety & Moderation", "Bug Squad", "Shape the Network", "Store Help"];
const TICKET_TYPE_OPTIONS = ["support", "appeal", "staff application", "creator application", "player report", "bug report", "suggestion", "store support"];

export function SupportCardDetailEditor({ cards, cardId, saveAction }: { cards: SupportCardSettings[]; cardId: string; saveAction: (data: FormData) => Promise<SupportSettingsResult> }) {
  const card = cards.find((item) => item.id === cardId)!;
  const [page, setPage] = useState<SupportPageDetails | undefined>(card.page);
  const [busy, start] = useTransition();
  const { toast } = useToast();

  function persist(nextPage: SupportPageDetails) {
    const nextCards = cards.map((item) => item.id === cardId ? { ...item, page: nextPage } : item);
    start(async () => {
      const data = new FormData();
      data.set("supportCardsJson", JSON.stringify(nextCards));
      const result = await saveAction(data);
      toast(result.message, result.ok ? "success" : "error");
    });
  }

  if (!page) {
    const destinationLabel = card.external ? "External website" : card.href === "/forums" ? "Discussion forum" : card.href === "/rules" ? "Server rules" : "Website page";
    return (
      <section className="cr-board overflow-hidden">
        <div className="border-b border-line px-5 py-5"><p className="eyebrow">Linked destination</p><h2 className="mt-2 font-display text-2xl font-black">{card.title}</h2><p className="mt-1 text-sm text-muted">This card currently links directly to another route or an external service and does not have a managed Support detail page.</p></div>
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card/60 p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted">Card action</p><p className="mt-2 font-display text-lg font-black text-ink">{destinationLabel}</p><p className="mt-1 text-sm text-muted">The destination is managed automatically from the card editor.</p><a href={card.href} target={card.external ? "_blank" : undefined} rel={card.external ? "noreferrer" : undefined} className="btn btn-secondary btn-sm mt-5">Open destination <ExternalLink size={14} /></a></div>
          <div className="rounded-2xl border border-accent/25 bg-accent/5 p-5"><FilePlus2 className="text-accent-bright" size={24} /><h3 className="mt-3 font-display text-lg font-black">Create a managed detail page</h3><p className="mt-1 text-sm leading-relaxed text-muted">Adds editable hero wording, required details, ticket/form type, and a privacy note for this card.</p><button type="button" onClick={() => setPage(newPage(card.title))} className="btn btn-primary btn-sm mt-5"><FilePlus2 size={14} /> Create page settings</button></div>
        </div>
      </section>
    );
  }

  return (
    <form action={() => persist(page)} className="cr-board min-w-0 overflow-hidden">
      <div className="border-b border-line px-4 py-5 sm:px-6"><p className="eyebrow">Managed detail page</p><h2 className="mt-2 font-display text-2xl font-black">{card.title}</h2><p className="mt-1 text-sm text-muted">Edit the content players see after selecting this Support card.</p></div>
      <div className="space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-line bg-card/50 p-4 sm:p-5"><h3 className="font-display text-lg font-black">Hero content</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wider text-muted">Eyebrow <span className="normal-case font-medium">(choose or type)</span><Input list="support-eyebrows" value={page.eyebrow} onChange={(event) => setPage({ ...page, eyebrow: event.target.value })} className="mt-1.5 w-full normal-case" required /><datalist id="support-eyebrows">{EYEBROW_OPTIONS.map((value) => <option key={value} value={value} />)}</datalist></label><label className="text-xs font-bold uppercase tracking-wider text-muted">Page title<Input value={page.title} onChange={(event) => setPage({ ...page, title: event.target.value })} className="mt-1.5 w-full normal-case" required /></label><label className="text-xs font-bold uppercase tracking-wider text-muted">Ticket / form type <span className="normal-case font-medium">(choose or type)</span><Input list="support-ticket-types" value={page.ticketType} onChange={(event) => setPage({ ...page, ticketType: event.target.value })} className="mt-1.5 w-full normal-case" required /><datalist id="support-ticket-types">{TICKET_TYPE_OPTIONS.map((value) => <option key={value} value={value} />)}</datalist></label><label className="text-xs font-bold uppercase tracking-wider text-muted md:col-span-2">Hero description<Textarea value={page.lead} onChange={(event) => setPage({ ...page, lead: event.target.value })} rows={4} className="mt-1.5 w-full normal-case" required /></label></div></section>
        <section className="rounded-2xl border border-line bg-card/50 p-4 sm:p-5"><h3 className="font-display text-lg font-black">Player preparation</h3><p className="mt-1 text-xs text-muted">Enter one required detail per line, in the order players should prepare them.</p><Textarea value={page.details.join("\n")} onChange={(event) => setPage({ ...page, details: event.target.value.split("\n").filter(Boolean) })} rows={9} className="mt-4 w-full normal-case" required /></section>
        <section className="rounded-2xl border border-line bg-card/50 p-4 sm:p-5"><h3 className="font-display text-lg font-black">Privacy &amp; safety</h3><Textarea value={page.privacyNote} onChange={(event) => setPage({ ...page, privacyNote: event.target.value })} rows={4} className="mt-4 w-full normal-case" required /></section>
      </div>
      <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-xs text-muted">Card listing fields are edited from the Support card directory.</p><div className="flex flex-col gap-2 sm:flex-row"><Link href="/admin/support/pages" className="btn btn-secondary btn-sm">Back to cards</Link><button type="submit" disabled={busy} className="btn btn-primary btn-sm"><Save size={14} /> {busy ? "Saving…" : "Save detail page"}</button></div></div>
    </form>
  );
}
