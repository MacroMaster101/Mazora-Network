"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, HelpCircle, Pencil, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import type { SupportFaq, SupportMainSettings } from "@/lib/data/support-settings";
import type { SupportSettingsResult } from "@/lib/actions/support-settings";
import { Input, Modal, Select, Textarea, useToast } from "@/components/ui";

const PRESETS = {
  eyebrow: ["We're here for you", "Mazora Support Center", "Help is one click away", "Player support"],
  responseBadge: ["Response time: under 24h", "Response time: 24–48h", "Replies as soon as possible", "Limited support availability"],
  availabilityBadge: ["Live Staff Online", "Support Team Available", "Discord Support Open", "Limited Staff Coverage"],
  trustBadge: ["Official Help Desk", "Verified Staff Support", "Private Discord Tickets", "Official Mazora Support"],
  searchPlaceholder: ["Search help topics, tickets, forum...", "What do you need help with?", "Search Support options...", "Find help, forms, and community links..."],
  faqTitle: ["Frequently Asked Questions", "Popular Support Questions", "Quick Answers", "Before You Contact Staff"],
  faqSubtitle: ["Quick answers to the most common inquiries.", "Find answers before opening a Support request.", "Helpful information for common Mazora questions.", "Everything players ask most often."],
} satisfies Partial<Record<keyof SupportMainSettings, string[]>>;

function PresetField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const custom = !options.includes(value);
  return (
    <div className="min-w-0">
      <label className="block text-xs font-bold uppercase tracking-wider text-muted">{label}</label>
      <Select value={custom ? "__custom__" : value} onChange={(event) => onChange(event.target.value === "__custom__" ? "" : event.target.value)} className="mt-1.5 w-full">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value="__custom__">Custom text…</option>
      </Select>
      {(custom || value === "") && <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={`Type custom ${label.toLowerCase()}…`} className="mt-2 w-full" required />}
    </div>
  );
}

type FaqDraft = { index: number | null; question: string; answer: string };

export function SupportMainEditor({ settings, saveAction }: { settings: SupportMainSettings; saveAction: (data: FormData) => Promise<SupportSettingsResult> }) {
  const [value, setValue] = useState(settings);
  const [faqQuery, setFaqQuery] = useState("");
  const [faqDraft, setFaqDraft] = useState<FaqDraft | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragMessage, setDragMessage] = useState("");
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const update = (patch: Partial<SupportMainSettings>) => setValue((current) => ({ ...current, ...patch }));
  const filteredFaqs = useMemo(() => value.faqs.map((faq, index) => ({ faq, index })).filter(({ faq }) => `${faq.question} ${faq.answer}`.toLowerCase().includes(faqQuery.trim().toLowerCase())), [faqQuery, value.faqs]);

  function saveFaq() {
    if (!faqDraft?.question.trim() || !faqDraft.answer.trim()) return;
    const next: SupportFaq = { question: faqDraft.question.trim(), answer: faqDraft.answer.trim() };
    update({ faqs: faqDraft.index === null ? [...value.faqs, next] : value.faqs.map((faq, index) => index === faqDraft.index ? next : faq) });
    setFaqDraft(null);
  }

  function moveFaq(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.faqs.length) return;
    const next = [...value.faqs];
    [next[index], next[target]] = [next[target], next[index]];
    update({ faqs: next });
    setDragMessage(`FAQ moved to position ${target + 1}.`);
  }

  function dropFaq(sourceIndex: number, targetIndex: number) {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= value.faqs.length || targetIndex >= value.faqs.length) return;
    const next = [...value.faqs];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    update({ faqs: next });
    setDragMessage(`${moved.question} moved to position ${targetIndex + 1}.`);
  }

  return (
    <>
      <form action={(data) => start(async () => { data.set("supportMainJson", JSON.stringify(value)); const result = await saveAction(data); toast(result.message, result.ok ? "success" : "error"); })} className="cr-board min-w-0 overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <p className="eyebrow">Public Support center</p>
          <h2 className="mt-2 font-display text-xl font-black">Hero, status &amp; FAQ editor</h2>
          <p className="mt-1 text-sm text-muted">Choose a recommended preset or select Custom text to type your own wording.</p>
        </div>

        <div className="space-y-7 p-4 sm:p-5">
          <section className="rounded-2xl border border-line bg-card/40 p-4 sm:p-5">
            <div className="mb-5"><p className="eyebrow">Page introduction</p><h3 className="mt-1 font-display text-lg font-black text-ink">Hero content</h3></div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <PresetField label="Eyebrow" value={value.eyebrow} options={PRESETS.eyebrow} onChange={(eyebrow) => update({ eyebrow })} />
              <label className="min-w-0 text-xs font-bold uppercase tracking-wider text-muted">Page title<Input value={value.title} onChange={(event) => update({ title: event.target.value })} className="mt-1.5 w-full normal-case" required /></label>
              <label className="min-w-0 text-xs font-bold uppercase tracking-wider text-muted md:col-span-2">Hero description<Textarea value={value.lead} onChange={(event) => update({ lead: event.target.value })} rows={4} className="mt-1.5 w-full normal-case" required /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card/40 p-4 sm:p-5">
            <div className="mb-5"><p className="eyebrow">Guided wording</p><h3 className="mt-1 font-display text-lg font-black text-ink">Status badges &amp; discovery</h3></div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <PresetField label="Response badge" value={value.responseBadge} options={PRESETS.responseBadge} onChange={(responseBadge) => update({ responseBadge })} />
              <PresetField label="Availability badge" value={value.availabilityBadge} options={PRESETS.availabilityBadge} onChange={(availabilityBadge) => update({ availabilityBadge })} />
              <PresetField label="Trust badge" value={value.trustBadge} options={PRESETS.trustBadge} onChange={(trustBadge) => update({ trustBadge })} />
              <PresetField label="Search placeholder" value={value.searchPlaceholder} options={PRESETS.searchPlaceholder} onChange={(searchPlaceholder) => update({ searchPlaceholder })} />
              <PresetField label="FAQ title" value={value.faqTitle} options={PRESETS.faqTitle} onChange={(faqTitle) => update({ faqTitle })} />
              <PresetField label="FAQ subtitle" value={value.faqSubtitle} options={PRESETS.faqSubtitle} onChange={(faqSubtitle) => update({ faqSubtitle })} />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card/40 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="eyebrow">FAQ library</p><h3 className="mt-1 font-display text-lg font-black text-ink">Frequently asked questions</h3><p className="mt-1 text-xs text-muted">Drag cards into order, or use the arrow buttons on keyboard and touch devices. Changes publish when you save.</p></div>
              <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setFaqDraft({ index: null, question: "", answer: "" })}><Plus size={14} /> Add FAQ</button>
            </div>
            <div className="relative mt-5"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input value={faqQuery} onChange={(event) => setFaqQuery(event.target.value)} placeholder="Search questions and answers…" className="w-full pl-10" /></div>
            {faqQuery.trim() && <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">Clear the FAQ search to enable drag-and-drop ordering.</p>}
            <p className="sr-only" aria-live="polite">{dragMessage}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {filteredFaqs.map(({ faq, index }) => (
                <article
                  key={`${index}-${faq.question}`}
                  draggable={!faqQuery.trim()}
                  onDragStart={(event) => {
                    if (faqQuery.trim()) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                    setDraggedIndex(index);
                    setDragMessage(`Moving FAQ ${index + 1}.`);
                  }}
                  onDragOver={(event) => {
                    if (faqQuery.trim()) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverIndex(index);
                  }}
                  onDragLeave={() => setDragOverIndex((current) => current === index ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceIndex = Number(event.dataTransfer.getData("text/plain"));
                    if (!Number.isNaN(sourceIndex)) dropFaq(sourceIndex, index);
                  }}
                  onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                  className={`flex min-w-0 flex-col rounded-xl border bg-surface/65 p-4 transition-all duration-150 ${draggedIndex === index ? "scale-[0.98] border-accent/50 opacity-50" : dragOverIndex === index ? "border-accent bg-accent/10 ring-2 ring-accent/25" : "border-line"}`}
                >
                  <div className="flex items-start justify-between gap-3"><span className="flex items-center gap-1.5 telemetry text-[10px] text-accent-bright"><GripVertical size={15} className={faqQuery.trim() ? "text-muted/35" : "cursor-grab text-muted active:cursor-grabbing"} aria-hidden /> FAQ #{index + 1}</span><div className="flex shrink-0 items-center gap-1"><button type="button" disabled={index === 0} onClick={() => moveFaq(index, -1)} aria-label="Move FAQ up" className="rounded-lg p-1.5 text-muted hover:bg-accent/10 hover:text-ink disabled:opacity-25"><ArrowUp size={14} /></button><button type="button" disabled={index === value.faqs.length - 1} onClick={() => moveFaq(index, 1)} aria-label="Move FAQ down" className="rounded-lg p-1.5 text-muted hover:bg-accent/10 hover:text-ink disabled:opacity-25"><ArrowDown size={14} /></button></div></div>
                  <h4 className="mt-2 break-words text-sm font-extrabold text-ink">{faq.question}</h4><p className="mt-2 line-clamp-3 break-words text-xs leading-relaxed text-muted">{faq.answer}</p>
                  <div className="mt-auto flex gap-2 pt-4"><button type="button" className="btn btn-secondary btn-xs flex-1" onClick={() => setFaqDraft({ index, ...faq })}><Pencil size={13} /> Edit</button><button type="button" className="btn btn-ghost btn-xs text-danger" onClick={() => setDeleteIndex(index)}><Trash2 size={13} /> Delete</button></div>
                </article>
              ))}
            </div>
            {filteredFaqs.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-line p-8 text-center"><HelpCircle className="mx-auto text-muted" size={24} /><p className="mt-2 text-sm font-bold text-ink">No FAQs found</p><p className="mt-1 text-xs text-muted">Clear the search or add a new question.</p></div>}
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <button type="button" onClick={() => setResetOpen(true)} className="btn btn-secondary btn-sm w-full sm:w-auto"><RotateCcw size={14} /> Reset changes</button>
          <p className="text-xs text-muted sm:mr-auto">Changes are recorded in the admin audit log.</p>
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm w-full sm:w-auto"><Save size={14} /> {busy ? "Saving…" : "Save Support Page"}</button>
        </div>
      </form>

      <Modal open={faqDraft !== null} onClose={() => setFaqDraft(null)} label={faqDraft?.index === null ? "Add FAQ" : "Edit FAQ"} size="default">
        <form onSubmit={(event) => { event.preventDefault(); saveFaq(); }} className="panel overflow-hidden">
          <div className="border-b border-line px-5 py-5 pr-16 sm:px-6"><p className="eyebrow">FAQ CRUD</p><h2 className="mt-2 font-display text-2xl font-black">{faqDraft?.index === null ? "Add a new question" : "Edit question"}</h2><p className="mt-1 text-sm text-muted">Write a direct question and a concise, useful answer.</p></div>
          <div className="space-y-5 p-5 sm:p-6"><label className="block text-xs font-bold uppercase tracking-wider text-muted">Question<Input autoFocus value={faqDraft?.question ?? ""} onChange={(event) => setFaqDraft((draft) => draft ? { ...draft, question: event.target.value } : null)} placeholder="What do players need to know?" className="mt-1.5 w-full normal-case" required /></label><label className="block text-xs font-bold uppercase tracking-wider text-muted">Answer<Textarea value={faqDraft?.answer ?? ""} onChange={(event) => setFaqDraft((draft) => draft ? { ...draft, answer: event.target.value } : null)} placeholder="Give a clear answer with the next action they should take." rows={7} className="mt-1.5 w-full normal-case" required /></label></div>
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" className="btn btn-secondary" onClick={() => setFaqDraft(null)}>Cancel</button><button type="submit" className="btn btn-primary"><Save size={15} /> {faqDraft?.index === null ? "Add FAQ" : "Update FAQ"}</button></div>
        </form>
      </Modal>

      <Modal open={deleteIndex !== null} onClose={() => setDeleteIndex(null)} label="Delete FAQ" size="compact">
        <div className="panel overflow-hidden p-5 sm:p-6"><span className="grid h-11 w-11 place-items-center rounded-xl border border-danger/25 bg-danger/10 text-danger"><AlertTriangle size={21} /></span><h2 className="mt-4 font-display text-xl font-black">Delete this FAQ?</h2><p className="mt-2 text-sm leading-relaxed text-muted">This removes <strong className="text-ink">{deleteIndex !== null ? value.faqs[deleteIndex]?.question : "this question"}</strong> from the editor. It will disappear publicly after you save the page.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn btn-secondary" onClick={() => setDeleteIndex(null)}>Keep FAQ</button><button type="button" className="btn btn-primary bg-danger" onClick={() => { if (deleteIndex !== null) update({ faqs: value.faqs.filter((_, index) => index !== deleteIndex) }); setDeleteIndex(null); }}><Trash2 size={15} /> Delete FAQ</button></div></div>
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} label="Reset Support editor" size="compact">
        <div className="panel overflow-hidden p-5 sm:p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500"><RotateCcw size={21} /></span>
          <h2 className="mt-4 font-display text-xl font-black">Reset unsaved changes?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">This restores the hero, presets, badges, FAQ content, and FAQ order to the last saved values. No active configuration will be lost.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn btn-secondary" onClick={() => setResetOpen(false)}>Keep editing</button><button type="button" className="btn btn-primary" onClick={() => { setValue(settings); setFaqQuery(""); setDraggedIndex(null); setDragOverIndex(null); setDragMessage("Editor reset to the last saved values."); setResetOpen(false); }}><RotateCcw size={15} /> Reset editor</button></div>
        </div>
      </Modal>
    </>
  );
}
