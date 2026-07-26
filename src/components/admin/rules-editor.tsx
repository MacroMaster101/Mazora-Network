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
import { cn } from "@/lib/utils";

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
                    <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">Name</span>
                    <Input name="name" defaultValue={category.name} required />
                  </label>
                  <label className="w-40">
                    <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">Icon key</span>
                    <Input name="icon" defaultValue={category.icon} placeholder="Shield" />
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
                  {category.rules.map((rule, i) => (
                    <div key={rule.id} className={cn("rounded-xl border border-line p-3", !rule.enabled && "opacity-60")}>
                      <form action={(fd) => run(saveRuleAction, fd)} className="space-y-2">
                        <input type="hidden" name="id" value={rule.id} />
                        <div className="flex items-center gap-2">
                          <span className="telemetry shrink-0 text-xs text-muted">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <Input name="title" defaultValue={rule.title} required aria-label="Rule title" />
                        </div>
                        <Textarea name="description" defaultValue={rule.description} rows={2} aria-label="Rule text" />
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
                              if (!confirm(`Delete the rule “${rule.title}”?`)) return;
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
                  ))}
                </div>

                {/* Add a rule */}
                <form
                  action={(fd) => run(addRuleAction, fd)}
                  className="mt-4 space-y-2 rounded-xl border border-dashed border-line-strong p-3"
                >
                  <input type="hidden" name="categoryId" value={category.id} />
                  <Input name="title" placeholder="New rule title" required aria-label="New rule title" />
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
          <label className="w-40">
            <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">Icon key</span>
            <Input name="icon" placeholder="Shield" />
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
