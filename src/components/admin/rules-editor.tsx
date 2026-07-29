"use client";

/**
 * Staff editor for the community rulebook.
 *
 * Each category is a collapsible block; each rule edits in place and saves on
 * demand. Everything is a server action, so an edit lands in the database and
 * the public page revalidates immediately — there is no separate publish step.
 */
import { useState, useTransition } from "react";
import { ChevronDown, Eye, EyeOff, MoveDown, MoveUp, Plus, Save, Trash2 } from "lucide-react";
import type { EditableCategory } from "@/lib/data/admin-overview";
import {
  addCategoryAction,
  addRuleAction,
  deleteCategoryAction,
  deleteRuleAction,
  reorderRuleAction,
  saveCategoryAction,
  saveRuleAction,
  toggleRuleAction,
  type RuleActionResult,
} from "@/lib/actions/rules";
import { Input, Textarea, useToast } from "@/components/ui";
import { Icon } from "@/components/shared/icon";
import { cn } from "@/lib/utils";

const PRESET_ICONS = [
  { key: "Shield", label: "Shield" },
  { key: "MessagesSquare", label: "Chat" },
  { key: "Gamepad2", label: "Gaming" },
  { key: "Swords", label: "Combat" },
  { key: "Coins", label: "Economy" },
  { key: "Handshake", label: "Trading" },
  { key: "Cpu", label: "Tech / Mods" },
  { key: "Bug", label: "Bugs / Exploits" },
  { key: "Gavel", label: "Punishments" },
  { key: "DiscordIcon", label: "Discord" },
  { key: "Sparkles", label: "Features" },
  { key: "BookOpen", label: "Rules" },
  { key: "Lock", label: "Security" },
  { key: "Scale", label: "Justice" },
];

function IconPicker({ name = "icon", defaultValue = "Shield" }: { name?: string; defaultValue?: string }) {
  const [selected, setSelected] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-card/80 px-3 text-sm text-ink hover:border-accent/40 transition-colors"
      >
        <span className="flex items-center gap-2.5 font-medium truncate">
          <Icon name={selected} size={16} className="text-accent-bright shrink-0" />
          <span className="truncate">{selected}</span>
        </span>
        <ChevronDown size={14} className={cn("text-muted shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 grid w-64 grid-cols-2 gap-1 rounded-xl border border-line bg-card p-2 shadow-2xl backdrop-blur-xl">
          {PRESET_ICONS.map((ico) => (
            <button
              key={ico.key}
              type="button"
              onClick={() => {
                setSelected(ico.key);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg p-2 text-left text-xs font-medium transition-colors",
                selected === ico.key
                  ? "bg-accent/15 text-accent-bright font-bold"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              )}
            >
              <Icon name={ico.key} size={15} className="shrink-0" />
              <span className="truncate">{ico.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RulesEditor({ categories }: { categories: EditableCategory[] }) {
  const [openId, setOpenId] = useState<string | null>(categories[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  /** Runs a server action and reports the outcome once. */
  const run = (action: (fd: FormData) => Promise<RuleActionResult>, formData: FormData) =>
    start(async () => {
      const res = await action(formData);
      toast(res.message, res.ok ? "success" : "error");
    });

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const open = openId === category.id;
        return (
          <section key={category.id} className="panel overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : category.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-ink/[0.03]"
            >
              <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
              <Icon name={category.icon} size={18} className="text-accent-bright shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{category.name}</span>
                <span className="block text-xs text-muted">
                  {category.rules.length} rule{category.rules.length === 1 ? "" : "s"} · /{category.slug}
                </span>
              </span>
              {category.rules.some((r) => !r.enabled) && (
                <span className="chip shrink-0 text-xs">
                  {category.rules.filter((r) => !r.enabled).length} hidden
                </span>
              )}
            </button>

            {open && (
              <div className="border-t border-line px-5 py-4">
                {/* Category settings */}
                <form
                  action={(fd) => run(saveCategoryAction, fd)}
                  className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-ink/[0.02] p-3"
                >
                  <input type="hidden" name="id" value={category.id} />
                  <label className="min-w-[10rem] flex-1">
                    <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">Category Name</span>
                    <Input name="name" defaultValue={category.name} required />
                  </label>
                  <label className="w-48">
                    <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">Category Icon</span>
                    <IconPicker name="icon" defaultValue={category.icon} />
                  </label>
                  <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="submit"
                    formAction={(fd) => {
                      if (!confirm(`Delete “${category.name}” and its ${category.rules.length} rules? This cannot be undone.`)) return;
                      run(deleteCategoryAction, fd);
                    }}
                    disabled={pending}
                    className="btn btn-ghost btn-sm text-danger"
                  >
                    <Trash2 size={14} /> Delete category
                  </button>
                </form>

                {/* Rules */}
                <div className="space-y-3">
                  {category.rules.map((rule, i) => {
                    const cleanTitle = rule.title.replace(/^(\d+\.\s*)+/, "");
                    return (
                      <div key={rule.id} className={cn("rounded-xl border border-line p-3", !rule.enabled && "opacity-60")}>
                        <form
                          action={(fd) => {
                            const rawTitle = String(fd.get("title") ?? "");
                            fd.set("title", rawTitle.replace(/^(\d+\.\s*)+/, ""));
                            run(saveRuleAction, fd);
                          }}
                          className="space-y-2"
                        >
                          <input type="hidden" name="id" value={rule.id} />
                          <div className="flex items-center gap-2">
                            <span className="telemetry shrink-0 rounded-md bg-accent/10 px-2 py-1 text-xs font-bold text-accent-bright">
                              Rule #{String(i + 1).padStart(2, "0")}
                            </span>
                            <Input name="title" defaultValue={cleanTitle} required aria-label="Rule title" placeholder="Rule title (e.g. Respect all players)" />
                          </div>
                          <Textarea name="description" defaultValue={rule.description} rows={2} aria-label="Rule text" placeholder="Rule description..." />
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
                              <Save size={13} /> Save
                            </button>
                            <button
                              type="submit"
                              formAction={(fd) => {
                                fd.set("enabled", String(!rule.enabled));
                                run(toggleRuleAction, fd);
                              }}
                              disabled={pending}
                              className="btn btn-ghost btn-sm"
                            >
                              {rule.enabled ? <EyeOff size={13} /> : <Eye size={13} />}
                              {rule.enabled ? "Hide" : "Show"}
                            </button>
                            <button
                              type="submit"
                              formAction={(fd) => {
                                fd.set("direction", "up");
                                run(reorderRuleAction, fd);
                              }}
                              disabled={pending || i === 0}
                              className="btn btn-ghost btn-sm"
                              aria-label="Move up"
                            >
                              <MoveUp size={13} />
                            </button>
                            <button
                              type="submit"
                              formAction={(fd) => {
                                fd.set("direction", "down");
                                run(reorderRuleAction, fd);
                              }}
                              disabled={pending || i === category.rules.length - 1}
                              className="btn btn-ghost btn-sm"
                              aria-label="Move down"
                            >
                              <MoveDown size={13} />
                            </button>
                            <button
                              type="submit"
                              formAction={(fd) => {
                                if (!confirm(`Delete rule #${i + 1} “${cleanTitle}”?`)) return;
                                run(deleteRuleAction, fd);
                              }}
                              disabled={pending}
                              className="btn btn-ghost btn-sm ml-auto text-danger"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </form>
                      </div>
                    );
                  })}
                </div>

                {/* Add a rule */}
                <form
                  action={(fd) => {
                    const rawTitle = String(fd.get("title") ?? "");
                    fd.set("title", rawTitle.replace(/^(\d+\.\s*)+/, ""));
                    run(addRuleAction, fd);
                  }}
                  className="mt-4 space-y-2 rounded-xl border border-dashed border-line-strong p-3"
                >
                  <input type="hidden" name="categoryId" value={category.id} />
                  <div className="flex items-center gap-2">
                    <span className="telemetry shrink-0 text-xs text-muted">
                      Rule #{String(category.rules.length + 1).padStart(2, "0")}
                    </span>
                    <Input name="title" placeholder="New rule title (no numbers needed)" required aria-label="New rule title" />
                  </div>
                  <Textarea name="description" placeholder="What does this rule mean in practice?" rows={2} aria-label="New rule text" />
                  <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
                    <Plus size={14} /> Add rule
                  </button>
                </form>
              </div>
            )}
          </section>
        );
      })}

      {/* Add a category */}
      {adding ? (
        <form action={(fd) => run(addCategoryAction, fd)} className="panel flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">Category name</span>
            <Input name="name" placeholder="e.g. Events" required autoFocus />
          </label>
          <label className="w-48">
            <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">Category Icon</span>
            <IconPicker name="icon" defaultValue="Shield" />
          </label>
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            <Plus size={14} /> Create
          </button>
          <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost btn-sm">
          <Plus size={14} /> New category
        </button>
      )}
    </div>
  );
}
