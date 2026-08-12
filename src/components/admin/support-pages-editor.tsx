"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, GripVertical, LayoutGrid, List, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { SupportCardSettings } from "@/lib/data/support-settings";
import type { SupportSettingsResult } from "@/lib/actions/support-settings";
import { Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { SUPPORT_ICON_OPTIONS, SupportCardIcon } from "@/components/shared/support-card-icon";

const BADGE_OPTIONS = ["Direct Help", "Community", "Appeals", "Recruitment", "Partners", "Safety", "Bug Squad", "Feedback", "Store Help", "Rules", "Live Discord"];
const emptyPage = { eyebrow: "Support", title: "New Support page", lead: "Explain how players should use this Support option.", ticketType: "support", details: ["Add the first required detail."], privacyNote: "Add a privacy or safety note." };
type Draft = { index: number | null; card: SupportCardSettings };

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function destinationKind(card: SupportCardSettings) {
  if (card.page) return "managed";
  if (card.href === "/forums") return "forums";
  if (card.href === "/rules") return "rules";
  if (card.external) return "external";
  return "linked";
}

export function SupportPagesEditor({ cards: initialCards, saveAction }: { cards: SupportCardSettings[]; saveAction: (data: FormData) => Promise<SupportSettingsResult> }) {
  const [cards, setCards] = useState(initialCards);
  const [view, setView] = useState<"cards" | "rows">("cards");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const filtered = useMemo(() => cards.map((card, index) => ({ card, index })).filter(({ card }) => `${card.title} ${card.badge} ${card.copy} ${card.category}`.toLowerCase().includes(query.trim().toLowerCase())), [cards, query]);

  function persist(next: SupportCardSettings[], message?: string) {
    setCards(next);
    start(async () => {
      const data = new FormData();
      data.set("supportCardsJson", JSON.stringify(next));
      const result = await saveAction(data);
      toast(result.ok && message ? message : result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  function saveDraft() {
    if (!draft?.card.title.trim() || !draft.card.id.trim()) return;
    if (cards.some((card, index) => card.id === draft.card.id && index !== draft.index)) {
      toast("Every Support card needs a unique ID.", "error");
      return;
    }
    const next = draft.index === null ? [...cards, draft.card] : cards.map((card, index) => index === draft.index ? draft.card : card);
    persist(next, draft.index === null ? "Support card created." : "Support card updated.");
    setDraft(null);
  }

  function move(index: number, target: number) {
    if (target < 0 || target >= cards.length || target === index) return;
    const next = [...cards];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    persist(next, `${moved.title} moved to position ${target + 1}.`);
  }

  function removeCard(index: number) {
    const removed = cards[index];
    persist(cards.filter((_, itemIndex) => itemIndex !== index), `${removed.title} deleted.`);
    setDeleteIndex(null);
  }

  return (
    <>
      <section className="cr-board min-w-0 overflow-hidden">
        <header className="border-b border-line px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><p className="eyebrow">Support destinations</p><h2 className="mt-2 font-display text-xl font-black">Support card directory</h2><p className="mt-1 max-w-2xl text-sm text-muted">Edit a card&apos;s public listing here. Select the card itself to open its dedicated detail-page editor.</p></div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-xl border border-line bg-card/60 p-1" aria-label="Directory layout">
                <button type="button" onClick={() => setView("cards")} className={`rounded-lg px-3 py-2 text-xs font-bold ${view === "cards" ? "bg-accent text-white" : "text-muted hover:text-ink"}`}><LayoutGrid size={14} className="inline-block" /> <span className="ml-1">Cards</span></button>
                <button type="button" onClick={() => setView("rows")} className={`rounded-lg px-3 py-2 text-xs font-bold ${view === "rows" ? "bg-accent text-white" : "text-muted hover:text-ink"}`}><List size={14} className="inline-block" /> <span className="ml-1">Rows</span></button>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft({ index: null, card: { id: `support-${Date.now()}`, icon: "ticket", title: "New Support option", copy: "Describe when players should use this option.", href: "/support/new-option", badge: "Support", category: "Support", external: false, enabled: true, page: { ...emptyPage } } })}><Plus size={14} /> Add card</button>
            </div>
          </div>
          <div className="relative mt-5"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all Support cards…" className="w-full pl-10" /></div>
          {query.trim() && <p className="mt-2 text-xs text-muted">Clear search to enable drag-and-drop ordering.</p>}
        </header>

        <div className={`grid gap-3 p-4 sm:p-5 ${view === "cards" ? "sm:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1"}`}>
          {filtered.map(({ card, index }) => (
            <article
              key={card.id}
              draggable={!query.trim()}
              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); setDraggedIndex(index); }}
              onDragOver={(event) => { if (query.trim()) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverIndex(index); }}
              onDragLeave={() => setDragOverIndex((current) => current === index ? null : current)}
              onDrop={(event) => { event.preventDefault(); const source = Number(event.dataTransfer.getData("text/plain")); setDraggedIndex(null); setDragOverIndex(null); if (!Number.isNaN(source)) move(source, index); }}
              onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
              className={`group relative flex min-w-0 ${view === "cards" ? "flex-col" : "items-center"} rounded-2xl border bg-card/70 p-4 transition-all ${draggedIndex === index ? "scale-[0.98] opacity-45" : dragOverIndex === index ? "border-accent bg-accent/10 ring-2 ring-accent/25" : "border-line hover:border-accent/35"}`}
            >
              <div className={`flex min-w-0 ${view === "cards" ? "items-start" : "flex-1 items-center"} gap-3`}>
                <span title="Drag to reorder" className={`mt-0.5 shrink-0 ${query.trim() ? "text-muted/30" : "cursor-grab text-muted active:cursor-grabbing"}`}><GripVertical size={18} /></span>
                <span className="flex shrink-0 flex-col">
                  <button type="button" disabled={index === 0 || busy} onClick={() => move(index, index - 1)} aria-label={`Move ${card.title} up`} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-20"><ArrowUp size={12} /></button>
                  <button type="button" disabled={index === cards.length - 1 || busy} onClick={() => move(index, index + 1)} aria-label={`Move ${card.title} down`} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-20"><ArrowDown size={12} /></button>
                </span>
                <Link href={`/admin/support/pages/${encodeURIComponent(card.id)}`} className={`min-w-0 flex-1 ${view === "cards" ? "" : "flex items-center gap-4"}`}>
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent-bright"><SupportCardIcon name={card.icon} size={20} /><small className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border border-line bg-card px-1 text-[9px] font-black text-muted">{index + 1}</small></span>
                  <span className={`min-w-0 ${view === "cards" ? "mt-3 block" : "block"}`}><strong className="block truncate font-display text-base font-black text-ink group-hover:text-accent-bright">{card.title}</strong><small className="mt-0.5 block truncate text-xs text-muted">{card.badge} · {card.category} · {card.page ? "Detail page" : card.external ? "External" : "Linked route"}</small></span>
                </Link>
                {view === "rows" && <span className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase sm:inline-flex ${card.enabled ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : "border-line bg-ink/5 text-muted"}`}>{card.enabled ? "Visible" : "Hidden"}</span>}
              </div>
              {view === "cards" && <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted">{card.copy}</p>}
              <div className={`flex items-center gap-2 ${view === "cards" ? "mt-4 border-t border-line/60 pt-3" : "ml-3 shrink-0"}`}>
                {view === "cards" && <span className={`mr-auto rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${card.enabled ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : "border-line bg-ink/5 text-muted"}`}>{card.enabled ? "Visible" : "Hidden"}</span>}
                <button type="button" onClick={() => setDraft({ index, card: structuredClone(card) })} className="btn btn-secondary btn-xs"><Pencil size={13} /> Edit</button>
                <button type="button" onClick={() => setDeleteIndex(index)} className="btn btn-ghost btn-xs text-danger" aria-label={`Delete ${card.title}`}><Trash2 size={13} /></button>
                <Link href={`/admin/support/pages/${encodeURIComponent(card.id)}`} className="btn btn-ghost btn-xs" aria-label={`Open ${card.title} details`}><ArrowRight size={14} /></Link>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-line p-10 text-center"><Search className="mx-auto text-muted" size={24} /><h3 className="mt-3 font-display font-black">No Support cards found</h3><p className="mt-1 text-sm text-muted">Clear the search or create a new card.</p></div>}
        </div>
        <footer className="flex flex-col gap-2 border-t border-line px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>{cards.length} cards · {cards.filter((card) => card.enabled).length} visible · {cards.filter((card) => card.page).length} managed detail pages</span><span>{busy ? "Saving changes…" : "CRUD changes save immediately"}</span></footer>
      </section>

      <Modal open={draft !== null} onClose={() => setDraft(null)} label={draft?.index === null ? "Create Support card" : "Edit Support card"} size="editor">
        {draft && <form onSubmit={(event) => { event.preventDefault(); saveDraft(); }} className="panel overflow-hidden">
          <div className="border-b border-line px-5 py-5 pr-16 sm:px-6"><p className="eyebrow">Card CRUD</p><h2 className="mt-2 font-display text-2xl font-black">{draft.index === null ? "Create Support card" : `Edit ${draft.card.title}`}</h2><p className="mt-1 text-sm text-muted">This popup controls the card shown in the public Support grid.</p></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Card title<Input value={draft.card.title} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, title: event.target.value, ...(draft.index === null ? { id: slugify(event.target.value) || draft.card.id, href: `/support/${slugify(event.target.value) || "new-option"}` } : {}) } })} className="mt-1.5 w-full normal-case" required /></label>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Badge <span className="normal-case font-medium">(choose or type)</span><Input list="support-badges" value={draft.card.badge} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, badge: event.target.value } })} className="mt-1.5 w-full normal-case" required /><datalist id="support-badges">{BADGE_OPTIONS.map((badge) => <option key={badge} value={badge} />)}</datalist></label>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Card action<Select value={destinationKind(draft.card)} onChange={(event) => {
              const kind = event.target.value;
              if (kind === "managed") setDraft({ ...draft, card: { ...draft.card, external: false, href: draft.card.page ? draft.card.href : `/support/${draft.card.id}`, page: draft.card.page ?? { ...emptyPage, title: draft.card.title } } });
              if (kind === "forums") setDraft({ ...draft, card: { ...draft.card, external: false, href: "/forums", page: undefined } });
              if (kind === "rules") setDraft({ ...draft, card: { ...draft.card, external: false, href: "/rules", page: undefined } });
              if (kind === "linked") setDraft({ ...draft, card: { ...draft.card, external: false, page: undefined } });
              if (kind === "external") setDraft({ ...draft, card: { ...draft.card, external: true, page: undefined } });
            }} className="mt-1.5 w-full normal-case"><option value="managed">Managed Support page</option><option value="forums">Discussion forum</option><option value="rules">Server rules</option><option value="external">External link</option>{destinationKind(draft.card) === "linked" && <option value="linked">Existing website page</option>}</Select></label>
            {destinationKind(draft.card) === "external" && <label className="text-xs font-bold uppercase tracking-wider text-muted sm:col-span-2">External web address<Input type="url" value={draft.card.href} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, href: event.target.value } })} placeholder="https://discord.gg/…" className="mt-1.5 w-full normal-case" required /></label>}
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Category<Select value={draft.card.category} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, category: event.target.value as SupportCardSettings["category"] } })} className="mt-1.5 w-full"><option>Support</option><option>Community</option><option>Apply</option></Select></label>
            <fieldset className="sm:col-span-2"><legend className="text-xs font-bold uppercase tracking-wider text-muted">Matching card icon</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{SUPPORT_ICON_OPTIONS.map((option) => <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-bold transition-colors ${draft.card.icon === option.value ? "border-accent bg-accent/10 text-accent-bright" : "border-line text-muted hover:border-accent/40 hover:text-ink"}`}><input type="radio" name="supportIcon" value={option.value} checked={draft.card.icon === option.value} onChange={() => setDraft({ ...draft, card: { ...draft.card, icon: option.value } })} className="sr-only" /><SupportCardIcon name={option.value} size={17} /><span>{option.label}</span></label>)}</div></fieldset>
            <label className="text-xs font-bold uppercase tracking-wider text-muted sm:col-span-2">Card description<Textarea value={draft.card.copy} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, copy: event.target.value } })} rows={4} className="mt-1.5 w-full normal-case" required /></label>
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs font-bold"><input type="checkbox" checked={draft.card.enabled} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, enabled: event.target.checked } })} className="checkbox checkbox-primary" /> Show publicly</label>
              <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs font-bold"><input type="checkbox" checked={draft.card.external} disabled={destinationKind(draft.card) !== "external"} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, external: event.target.checked } })} className="checkbox checkbox-primary" /> New browser tab <ExternalLink size={13} /></label>
              <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs font-bold"><input type="checkbox" checked={Boolean(draft.card.page)} disabled={draft.index !== null && Boolean(cards[draft.index]?.page)} onChange={(event) => setDraft({ ...draft, card: { ...draft.card, page: event.target.checked ? (draft.card.page ?? { ...emptyPage, title: draft.card.title }) : undefined } })} className="checkbox checkbox-primary" /> Managed detail page</label>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>Cancel</button><button type="submit" disabled={busy} className="btn btn-primary">{draft.index === null ? <Plus size={15} /> : <Pencil size={15} />} {busy ? "Saving…" : draft.index === null ? "Create card" : "Update card"}</button></div>
        </form>}
      </Modal>

      <Modal open={deleteIndex !== null} onClose={() => setDeleteIndex(null)} label="Delete Support card" size="compact">
        <div className="panel p-5 sm:p-6"><span className="grid h-11 w-11 place-items-center rounded-xl border border-danger/25 bg-danger/10 text-danger"><Trash2 size={20} /></span><h2 className="mt-4 font-display text-xl font-black">Delete this Support card?</h2><p className="mt-2 text-sm leading-relaxed text-muted">This removes <strong className="text-ink">{deleteIndex !== null ? cards[deleteIndex]?.title : "the card"}</strong> and its managed detail settings from the public Support directory.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn btn-secondary" onClick={() => setDeleteIndex(null)}>Keep card</button><button type="button" className="btn btn-primary bg-danger" disabled={busy} onClick={() => deleteIndex !== null && removeCard(deleteIndex)}><Trash2 size={15} /> Delete card</button></div></div>
      </Modal>
    </>
  );
}
