"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Monitor, RotateCcw, Save } from "lucide-react";
import { BackLink } from "@/components/shared";
import { savePageContentAction } from "@/lib/actions/page-content";
import type { PageContentDefinition, PageContentPanel } from "@/lib/page-content";
import { Input, useToast } from "@/components/ui";

function valuesForPanel(panel: PageContentPanel, source: Record<string, string>) {
  return Object.fromEntries(panel.fields.map((item) => [item.key, source[item.key] ?? ""]));
}

function PageContentPanelEditor({
  pageId,
  panel,
  panelIndex,
  initialContent,
  active,
  onActivate,
  onDraftChange,
}: {
  pageId: PageContentDefinition["id"];
  panel: PageContentPanel;
  panelIndex: number;
  initialContent: Record<string, string>;
  active: boolean;
  onActivate: () => void;
  onDraftChange: (values: Record<string, string>) => void;
}) {
  const [state, formAction, pending] = useActionState(savePageContentAction, null);
  const [savedContent, setSavedContent] = useState(() => valuesForPanel(panel, initialContent));
  const [content, setContent] = useState(() => valuesForPanel(panel, initialContent));
  const { toast } = useToast();

  useEffect(() => {
    if (!state?.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok && state.content) {
      setSavedContent(state.content);
      setContent(state.content);
      onDraftChange(state.content);
    }
  }, [onDraftChange, state, toast]);

  function updateField(key: string, value: string) {
    const next = { ...content, [key]: value };
    setContent(next);
    onDraftChange(next);
  }

  function resetPanel() {
    setContent(savedContent);
    onDraftChange(savedContent);
    toast(`${panel.title} restored to its last saved content.`, "info");
  }

  const dirty = panel.fields.some((item) => content[item.key] !== savedContent[item.key]);

  return (
    <form
      action={formAction}
      className={`panel overflow-hidden transition-colors ${active ? "border-accent/40" : ""}`}
      onFocusCapture={onActivate}
      onClick={onActivate}
    >
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="panelId" value={panel.id} />
      <div className="flex items-start gap-4 border-b border-line bg-accent/[0.045] p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="telemetry grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-xs font-extrabold text-accent-bright">{String(panelIndex + 1).padStart(2, "0")}</span>
          <div><h2 className="font-display text-lg font-extrabold text-ink">{panel.title}</h2><p className="mt-1 text-sm leading-6 text-muted">{panel.description}</p></div>
        </div>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        {panel.fields.map((item) => {
          const value = content[item.key] ?? "";
          const wide = item.type === "textarea";
          return (
            <label key={item.key} className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}>
              <span className="flex items-center justify-between gap-3 text-xs font-bold text-ink">{item.label}<span className="telemetry text-[10px] font-medium text-muted">{value.length}/{item.maxLength}</span></span>
              {wide ? (
                <textarea name={item.key} rows={3} maxLength={item.maxLength} value={value} onChange={(event) => updateField(item.key, event.target.value)} className="field w-full rounded-xl px-3.5 py-3 text-sm" />
              ) : (
                <Input name={item.key} maxLength={item.maxLength} value={value} onChange={(event) => updateField(item.key, event.target.value)} />
              )}
              {item.help && <span className="block text-[11px] leading-5 text-muted">{item.help}</span>}
              {state?.errors?.[item.key] && <span className="block text-xs font-semibold text-red-500">{state.errors[item.key]}</span>}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-black/[0.035] px-5 py-4 sm:px-6">
        <button type="button" className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-45" onClick={resetPanel} disabled={!dirty || pending}><RotateCcw size={14} /> Reset section</button>
        <button type="submit" className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-45" disabled={!dirty || pending}><Save size={14} /> {pending ? "Saving…" : "Save section"}</button>
      </div>
    </form>
  );
}

export function PageContentEditor({ definition, initialContent }: { definition: PageContentDefinition; initialContent: Record<string, string> }) {
  const [content, setContent] = useState(initialContent);
  const [activePanel, setActivePanel] = useState(definition.panels[0]?.id ?? "");
  const [previewReady, setPreviewReady] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const updateDraft = useCallback((values: Record<string, string>) => {
    setContent((current) => ({ ...current, ...values }));
  }, []);

  const syncPreview = useCallback(() => {
    const document = previewRef.current?.contentDocument;
    if (!document) return;
    for (const [key, value] of Object.entries(content)) {
      document.querySelectorAll<HTMLElement>(`[data-page-field="${key}"]`).forEach((element) => {
        element.textContent = value;
      });
    }
  }, [content]);

  useEffect(() => {
    if (previewReady) syncPreview();
  }, [previewReady, syncPreview]);

  useEffect(() => {
    if (!previewReady) return;
    const document = previewRef.current?.contentDocument;
    const panel = definition.panels.find((item) => item.id === activePanel);
    const target = panel?.fields
      .map((item) => document?.querySelector<HTMLElement>(`[data-page-field="${item.key}"]`))
      .find(Boolean);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activePanel, definition.panels, previewReady]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card/80 p-3 backdrop-blur-xl">
        <BackLink href="/admin/pages" label="Back to Pages" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-xs font-semibold text-muted sm:inline">Each panel saves independently</span>
          {definition.managerPath && (
            <Link href={definition.managerPath} className="btn btn-ghost btn-sm">
              {definition.managerLabel ?? "Manage page data"} <ExternalLink size={14} />
            </Link>
          )}
          <Link href={definition.path} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">View live page <ExternalLink size={14} /></Link>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(290px,0.62fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.7fr)]">
        <div className="min-w-0 space-y-5">
          {definition.panels.map((panel, panelIndex) => (
            <PageContentPanelEditor
              key={panel.id}
              pageId={definition.id}
              panel={panel}
              panelIndex={panelIndex}
              initialContent={initialContent}
              active={activePanel === panel.id}
              onActivate={() => setActivePanel(panel.id)}
              onDraftChange={updateDraft}
            />
          ))}
        </div>

        <aside className="order-first overflow-hidden rounded-2xl border border-accent/25 bg-card/90 shadow-2xl lg:order-last lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-black/15 px-4 py-3">
            <span className="flex items-center gap-2 text-xs font-extrabold text-ink"><Monitor size={15} className="text-accent-bright" /> Live page preview</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Updates as you type</span>
          </div>
          <iframe
            ref={previewRef}
            src={`${definition.path}${definition.path.includes("?") ? "&" : "?"}adminPreview=1`}
            title={`${definition.label} live page preview`}
            onLoad={() => setPreviewReady(true)}
            className="h-[420px] w-full bg-black/20 sm:h-[560px] lg:h-[70vh] lg:min-h-[580px]"
          />
          <div className="border-t border-line px-4 py-2 text-[10px] leading-4 text-muted">Showing the actual public page. Focus a panel to jump to its matching section; save only the section you are ready to publish.</div>
        </aside>
      </div>
    </div>
  );
}
