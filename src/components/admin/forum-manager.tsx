"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Flag, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import type { BoardCategory } from "@/lib/data/forums";
import { CreateForumButton, NewCategoryButton } from "@/components/forums/forum-dialogs";
import { SeeMoreList } from "@/components/forums/see-more-list";
import { useToast } from "@/components/ui";
import {
  deleteCategoryAction,
  deleteForumAction,
  moveCategoryAction,
  moveForumAction,
  setForumLockedAction,
  updateCategoryAction,
  updateForumAction,
} from "@/lib/actions/forums-admin";

export function ForumManager({
  categories,
  reportCounts,
}: {
  categories: BoardCategory[];
  /** Open reports per forum id; forums without any are absent. */
  reportCounts: Record<string, number>;
}) {
  const { toast } = useToast();
  const report = (result: { ok: boolean; message: string }) => toast(result.message, result.ok ? "success" : "error");
  const [pending, startTransition] = useTransition();
  const choices = categories.map(({ id, name }) => ({ id, name }));

  const run = (work: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => report(await work()));

  /*
    Rename forms are never reset, even on success: their inputs are
    uncontrolled with the current name as defaultValue, so reset() would snap
    them back to the OLD name before the revalidated props arrive — and React
    never re-syncs a mounted uncontrolled input. The box would show the stale
    name and a second Save would silently revert the rename in the database.
    Creating forums and categories happens in the shared dialogs instead.
  */
  const runOnSubmit =
    (work: (formData: FormData) => Promise<{ ok: boolean; message: string }>) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(async () => report(await work(formData)));
    };

  return (
    <div className="space-y-6">

      {/* The same dialogs the public board uses, so a forum is created one way everywhere. */}
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-display text-base font-bold">Add to the board</p>
          <p className="text-sm text-muted">Create a forum in any category, or type a new category name to add one.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateForumButton categories={choices} afterCreate="refresh" className="btn btn-primary btn-sm" />
          <NewCategoryButton />
        </div>
      </div>

      {categories.map((category) => (
        <section key={category.id} className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold">{category.name}</h2>
            <span className="flex gap-1">
              <button
                type="button"
                disabled={pending}
                aria-label={`Move ${category.name} up`}
                className="btn btn-ghost btn-sm"
                onClick={() => run(() => moveCategoryAction(category.id, "up"))}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={pending}
                aria-label={`Move ${category.name} down`}
                className="btn btn-ghost btn-sm"
                onClick={() => run(() => moveCategoryAction(category.id, "down"))}
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                disabled={pending || category.forums.length > 0}
                title={category.forums.length > 0 ? "Delete or move its forums first" : undefined}
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (window.confirm(`Delete the "${category.name}" category?`)) run(() => deleteCategoryAction(category.id));
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </span>
          </div>

          <form className="flex flex-wrap gap-2" onSubmit={runOnSubmit(updateCategoryAction)}>
            <input type="hidden" name="categoryId" value={category.id} />
            <input
              name="name"
              defaultValue={category.name}
              required
              minLength={2}
              maxLength={80}
              className="input flex-1"
            />
            <input
              name="description"
              defaultValue={category.description ?? ""}
              maxLength={200}
              placeholder="Description"
              className="input flex-1"
            />
            <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
              <Pencil size={14} /> Save
            </button>
          </form>

          {category.forums.length === 0 ? (
            <p className="py-3 text-sm text-muted">No forums yet.</p>
          ) : (
            <SeeMoreList as="ul" className="divide-y divide-line" toggleClassName="py-3">
              {category.forums.map((forum) => (
                <li key={forum.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="truncate">{forum.name}</strong>
                      {reportCounts[forum.id] ? (
                        <Link
                          href={`/admin/forums/reports?forum=${forum.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-700 transition hover:bg-red-500/20 dark:text-red-400"
                        >
                          <Flag size={12} aria-hidden="true" /> {reportCounts[forum.id]}{" "}
                          {reportCounts[forum.id] === 1 ? "report" : "reports"}
                        </Link>
                      ) : null}
                    </span>
                    <small className="text-muted">/forums/{forum.slug} · {forum.topicCount} topics</small>
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Move ${forum.name} up`}
                      className="btn btn-ghost btn-sm"
                      onClick={() => run(() => moveForumAction(forum.id, "up"))}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Move ${forum.name} down`}
                      className="btn btn-ghost btn-sm"
                      onClick={() => run(() => moveForumAction(forum.id, "down"))}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="btn btn-ghost btn-sm"
                      onClick={() => run(() => setForumLockedAction(forum.id, !forum.locked))}
                    >
                      {forum.locked ? <><LockOpen size={14} /> Unlock</> : <><Lock size={14} /> Lock</>}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${forum.name}"? This also permanently deletes every topic and post inside it.`,
                          )
                        ) {
                          run(() => deleteForumAction(forum.id));
                        }
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </span>
                  <form
                    className="flex w-full flex-wrap gap-2"
                    onSubmit={runOnSubmit(updateForumAction)}
                  >
                    <input type="hidden" name="forumId" value={forum.id} />
                    <input
                      name="name"
                      defaultValue={forum.name}
                      required
                      minLength={2}
                      maxLength={80}
                      className="input flex-1"
                    />
                    <input
                      name="description"
                      defaultValue={forum.description ?? ""}
                      maxLength={200}
                      placeholder="Description"
                      className="input flex-1"
                    />
                    <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
                      <Pencil size={14} /> Save
                    </button>
                  </form>
                </li>
              ))}
            </SeeMoreList>
          )}

          <CreateForumButton
            categories={choices}
            initialCategory={category.name}
            afterCreate="refresh"
            label={`Add forum to ${category.name}`}
          />
        </section>
      ))}
    </div>
  );
}
