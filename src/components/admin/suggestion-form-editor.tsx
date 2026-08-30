"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui";
import type { SuggestionFormSettings } from "@/lib/data/suggestion-form-settings";
import { saveSuggestionFormSettingsAction } from "@/lib/actions/suggestion-form-settings";

/**
 * Edits what members see on the "Start a new suggestion" form.
 *
 * Categories are the part with teeth: the public form renders one control per
 * entry and the board validates a submitted category against the same list, so
 * removing one that existing suggestions already use hides them from that
 * filter. The warning below says so rather than leaving it to be discovered.
 */
/**
 * Ready-made category sets. Applying one replaces the whole list rather than
 * merging: a half-swapped set (three from one theme, two from another) reads
 * worse than either, and the member only ever sees the final list.
 */
const CATEGORY_PRESETS: Array<{ name: string; categories: string[] }> = [
  { name: "Default", categories: ["Gameplay", "Website", "Discord", "Events", "Store", "Other"] },
  { name: "Game-focused", categories: ["Survival", "Skyblock", "Lifesteal", "PvP", "Economy", "Builds", "Other"] },
  { name: "Simple", categories: ["Feature", "Bug", "Balance", "Other"] },
  { name: "Community", categories: ["Gameplay", "Events", "Discord", "Creators", "Moderation", "Other"] },
];

export function SuggestionFormEditor({ initial }: { initial: SuggestionFormSettings }) {
  const [draft, setDraft] = useState<SuggestionFormSettings>(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function setCategory(index: number, value: string) {
    setDraft((d) => ({ ...d, categories: d.categories.map((c, i) => (i === index ? value : c)) }));
  }

  function removeCategory(index: number) {
    setDraft((d) => ({ ...d, categories: d.categories.filter((_, i) => i !== index) }));
  }

  function addCategory() {
    setDraft((d) => ({ ...d, categories: [...d.categories, ""] }));
  }

  function save() {
    const cleaned = {
      ...draft,
      categories: draft.categories.map((c) => c.trim()).filter(Boolean),
    };
    if (!cleaned.categories.length) {
      toast("Keep at least one category — members choose one when posting.", "error");
      return;
    }

    const formData = new FormData();
    formData.set("suggestionFormJson", JSON.stringify(cleaned));

    startTransition(async () => {
      try {
        const result = await saveSuggestionFormSettingsAction(formData);
        toast(result.message, result.ok ? "success" : "error");
        if (result.ok) {
          setDraft(cleaned);
          router.refresh();
        }
      } catch {
        toast("Those settings could not be saved.", "error");
      }
    });
  }

  return (
    <div className="panel space-y-6 p-5 sm:p-6">
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-sm font-bold text-ink">Start from an example</h3>
          <p className="text-xs text-muted">
            Replaces the whole category list below. Edit afterwards — nothing saves until you press save.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, categories: [...preset.categories] }))}
                className="chip"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-3">
          <h3 className="font-display text-sm font-bold text-ink">Categories</h3>
          <p className="text-xs text-muted">
            Shown under “Where does it belong?”. Removing one that existing suggestions already use
            will hide them from that filter — rename instead of deleting where you can.
          </p>
        </div>

        <ul className="space-y-2">
          {draft.categories.map((category, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                value={category}
                onChange={(event) => setCategory(index, event.target.value)}
                placeholder="Category name"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeCategory(index)}
                disabled={draft.categories.length <= 1}
                title={draft.categories.length <= 1 ? "At least one category is required" : "Remove category"}
                className="btn btn-ghost btn-sm shrink-0 disabled:opacity-40"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>

        <button type="button" onClick={addCategory} disabled={draft.categories.length >= 12} className="btn btn-ghost btn-sm">
          <Plus size={15} /> Add category
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-sm font-bold text-ink">Helper copy</h3>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Title placeholder</span>
          <input
            value={draft.titlePlaceholder}
            onChange={(event) => setDraft((d) => ({ ...d, titlePlaceholder: event.target.value }))}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Description placeholder</span>
          <textarea
            rows={2}
            value={draft.descriptionPlaceholder}
            onChange={(event) => setDraft((d) => ({ ...d, descriptionPlaceholder: event.target.value }))}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Footnote under the composer</span>
          <input
            value={draft.footnote}
            onChange={(event) => setDraft((d) => ({ ...d, footnote: event.target.value }))}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary btn-sm">
          <Save size={15} /> {pending ? "Saving…" : "Save form settings"}
        </button>
      </div>
    </div>
  );
}
