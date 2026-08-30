"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Save } from "lucide-react";
import { useToast } from "@/components/ui";
import { saveSuggestionsPageAction } from "@/lib/actions/suggestions-page-settings";

/**
 * Examples staff can apply instead of writing hero copy from scratch. Each is a
 * complete, coherent set — picking one fills all three fields, because a title
 * and an intro written for different tones read worse than either alone.
 */
const PRESETS: Array<{ name: string; eyebrow: string; title: string; lead: string }> = [
  {
    name: "Open call",
    eyebrow: "Shape the network",
    title: "Suggest a feature",
    lead: "The best ideas come from players. Share yours with enough detail for the team and community to understand it.",
  },
  {
    name: "Roadmap focus",
    eyebrow: "Community roadmap",
    title: "Help decide what we build next",
    lead: "Post an idea, back the ones you want most, and follow them as the team moves them from open to planned.",
  },
  {
    name: "Feedback drive",
    eyebrow: "Player feedback",
    title: "Tell us what to fix first",
    lead: "Something feel off, missing, or half-finished? Describe it clearly and we will triage it with the rest of the board.",
  },
  {
    name: "Seasonal event",
    eyebrow: "Season planning",
    title: "Pitch an idea for the next season",
    lead: "We are planning the next update. Share the features, events, or changes you want to see, and vote on the rest.",
  },
];

export function SuggestionsPageEditor({
  initial,
}: {
  initial: { eyebrow: string; title: string; lead: string; enabled: boolean };
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function save() {
    const formData = new FormData();
    formData.set("eyebrow", draft.eyebrow);
    formData.set("title", draft.title);
    formData.set("lead", draft.lead);
    if (draft.enabled) formData.set("enabled", "on");

    startTransition(async () => {
      try {
        const result = await saveSuggestionsPageAction(formData);
        toast(result.message, result.ok ? "success" : "error");
        if (result.ok) router.refresh();
      } catch {
        toast("Those settings could not be saved.", "error");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Open/closed sits above the copy: it decides whether any of the wording
          below is reachable at all. */}
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
            {draft.enabled ? <Eye size={15} className="text-accent-bright" /> : <EyeOff size={15} className="text-muted" />}
            Board visibility
          </h3>
          <p className="mt-1 text-xs text-muted">
            {draft.enabled
              ? "Members can browse and post. Turn off to show the “coming soon” page instead."
              : "Members see the “coming soon” page. Existing ideas and replies are kept, just hidden."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.enabled}
          onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
          className={`btn btn-sm shrink-0 ${draft.enabled ? "btn-primary" : "btn-secondary"}`}
        >
          {draft.enabled ? "Board is open" : "Board is closed"}
        </button>
      </section>

      <section className="panel space-y-4 p-5">
        <div>
          <h3 className="font-display text-sm font-bold text-ink">Start from an example</h3>
          <p className="mt-1 text-xs text-muted">
            Fills all three fields below. You can edit them afterwards — nothing saves until you press save.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, eyebrow: preset.eyebrow, title: preset.title, lead: preset.lead }))}
                className="chip"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <h3 className="font-display text-sm font-bold text-ink">Hero content</h3>
          <p className="mt-1 text-xs text-muted">
            These three are the only fields the suggestions page renders — it shows the board below the hero
            rather than a checklist, so there is nothing else here to fill in.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted">Eyebrow</span>
              <input
                value={draft.eyebrow}
                onChange={(event) => setDraft((d) => ({ ...d, eyebrow: event.target.value }))}
                maxLength={60}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted">Page title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                maxLength={80}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted">Intro</span>
              <textarea
                rows={3}
                value={draft.lead}
                onChange={(event) => setDraft((d) => ({ ...d, lead: event.target.value }))}
                maxLength={400}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary btn-sm">
            <Save size={15} /> {pending ? "Saving…" : "Save page settings"}
          </button>
        </div>
      </section>
    </div>
  );
}
