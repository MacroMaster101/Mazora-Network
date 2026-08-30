"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lightbulb, Loader2, Plus, Send, Sparkles, X } from "lucide-react";
import { submitSuggestion, type ActionResult } from "@/lib/actions/support";
import { Input, Textarea } from "@/components/ui";
import type { SuggestionFormSettings } from "@/lib/data/suggestion-form-settings";
import { ImagePicker } from "./image-picker";

const initialState: ActionResult = { ok: false };

/**
 * `submitSuggestion` is a Server Action invoked directly as this form's
 * `action` prop (via `useActionState`), not manually awaited by this
 * component — so there is no local call site to wrap in try/catch. If the
 * transport rejects the request body (too large) or the network fails, the
 * promise React awaits internally rejects and throws to the nearest error
 * boundary, crashing the dialog and losing everything the member typed. This
 * wrapper is the call site: it is what `useActionState` actually invokes, so
 * catching here catches that rejection before React ever sees it.
 */
async function safeSubmitSuggestion(prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    return await submitSuggestion(prevState, formData);
  } catch (error) {
    console.error("Failed to submit suggestion", error);
    return { ok: false, message: "Your suggestion could not be sent. If you attached images, try smaller ones." };
  }
}

function Composer({ onClose, form }: { onClose: () => void; form: SuggestionFormSettings }) {
  const [state, formAction, pending] = useActionState(safeSubmitSuggestion, initialState);
  // Seeded from the first configured category, so an admin who renames or
  // reorders them never leaves the form defaulting to one that no longer exists.
  const [category, setCategory] = useState<string>(form.categories[0] ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  // Portalled to <body>. This dialog is triggered from inside a `.glass` card,
  // and `backdrop-filter` makes an element a containing block for fixed-position
  // descendants — so `fixed inset-0` resolved against that card instead of the
  // viewport, clipping the modal into a sliver of the page. Every other modal in
  // this codebase portals for the same reason (see report-button.tsx).
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close new suggestion dialog" />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-suggestion-title"
        className="relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-line-strong bg-card text-ink shadow-2xl shadow-black/40"
      >
        <header className="relative overflow-hidden border-b border-line px-6 py-5 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(var(--accent-rgb)/0.18),transparent_52%)]" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent-bright">
                <Sparkles size={21} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">Community workshop</p>
                <h2 id="new-suggestion-title" className="mt-1 font-display text-2xl font-black">Start a new suggestion</h2>
                <p className="mt-1 text-sm text-muted">Explain the change, why it matters, and what a good result looks like.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-ink/[0.03] text-muted transition hover:border-accent/40 hover:text-ink" aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>
        </header>

        {state.ok ? (
          <div className="flex flex-col items-center px-6 py-14 text-center sm:px-8">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-success/30 bg-success/10 text-success">
              <CheckCircle2 size={32} />
            </span>
            <h3 className="mt-5 font-display text-2xl font-bold">Your idea is live</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">{state.message}</p>
            <button type="button" onClick={onClose} className="btn btn-primary mt-6">View the board</button>
          </div>
        ) : (
          <form action={formAction} className="max-h-[min(72vh,700px)] space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
            <div>
              <label htmlFor={titleId} className="flex items-center justify-between text-sm font-semibold">
                <span>Suggestion title</span>
                <span className="text-xs font-normal text-muted">{title.length}/160</span>
              </label>
              <Input id={titleId} name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder={form.titlePlaceholder} className="mt-2" />
              {state.errors?.title && <p className="mt-1.5 text-xs text-danger" role="alert">{state.errors.title}</p>}
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">Where does it belong?</legend>
              <input type="hidden" name="category" value={category} />
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Suggestion category">
                {form.categories.map((item) => {
                  const selected = category === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setCategory(item)}
                      className={selected
                        ? "flex items-center gap-2 rounded-xl border border-accent bg-accent/10 px-3 py-3 text-left text-sm font-bold text-accent-bright shadow-[0_0_0_3px_rgb(var(--accent-rgb)/0.08)]"
                        : "flex items-center gap-2 rounded-xl border border-line bg-ink/[0.025] px-3 py-3 text-left text-sm font-semibold text-muted transition hover:border-accent/40 hover:text-ink"}
                    >
                      <span className={selected ? "h-2 w-2 rounded-full bg-accent-bright" : "h-2 w-2 rounded-full bg-line-strong"} />
                      {item}
                    </button>
                  );
                })}
              </div>
              {state.errors?.category && <p className="mt-1.5 text-xs text-danger" role="alert">{state.errors.category}</p>}
            </fieldset>

            <div>
              <label htmlFor={descriptionId} className="flex items-center justify-between text-sm font-semibold">
                <span>Describe the idea</span>
                <span className="text-xs font-normal text-muted">{description.length}/10,000</span>
              </label>
              <Textarea id={descriptionId} name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={7} maxLength={10_000} required placeholder={form.descriptionPlaceholder} className="mt-2 min-h-40" />
              {state.errors?.description && <p className="mt-1.5 text-xs text-danger" role="alert">{state.errors.description}</p>}
            </div>

            <div>
              <p className="text-sm font-semibold">Attach images (optional)</p>
              <div className="mt-2">
                <ImagePicker />
              </div>
            </div>

            {state.message && !state.ok && <p className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{state.message}</p>}

            <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-muted"><Lightbulb size={14} className="text-accent-bright" /> {form.footnote}</p>
              <button type="submit" disabled={pending || title.trim().length < 4 || description.trim().length < 20} className="btn btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {pending ? "Publishing…" : "Publish suggestion"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}

export function NewSuggestionDialog({ className = "btn btn-primary", label = "New suggestion", form }: { className?: string; label?: string; form: SuggestionFormSettings }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  function show() {
    setVersion((value) => value + 1);
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={show} className={className}>
        <Plus size={16} aria-hidden="true" /> {label}
      </button>
      {open && <Composer key={version} onClose={() => setOpen(false)} form={form} />}
    </>
  );
}
