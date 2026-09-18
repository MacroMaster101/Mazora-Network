"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Plus } from "lucide-react";
import { createCategoryAction, createForumInCategoryAction } from "@/lib/actions/forums-admin";
import { Modal, useToast } from "@/components/ui";
import { DialogHeader, Notice } from "./dialog-parts";

export interface CategoryChoice {
  id: string;
  name: string;
}

/**
 * "Create a forum" and its dialog, used on the public board and in the admin
 * so both create forums the same way.
 *
 * `initialCategory` preselects a category (the admin's per-category button).
 * `afterCreate` decides where the creator lands: the new forum from the board,
 * or a refreshed list in the admin.
 */
export function CreateForumButton({
  categories,
  initialCategory,
  afterCreate = "open",
  label = "Create a forum",
  className = "btn btn-ghost btn-sm",
}: {
  categories: CategoryChoice[];
  initialCategory?: string;
  afterCreate?: "open" | "refresh";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setVersion((value) => value + 1);
          setOpen(true);
        }}
      >
        <Plus size={15} /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label="Create a forum" size="compact">
        <CreateForum
          key={version}
          categories={categories}
          initialCategory={initialCategory}
          afterCreate={afterCreate}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function CreateForum({
  categories,
  initialCategory,
  afterCreate,
  onDone,
}: {
  categories: CategoryChoice[];
  initialCategory?: string;
  afterCreate: "open" | "refresh";
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(initialCategory ?? categories[0]?.name ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const typed = category.trim();
  const isNewCategory = typed.length > 0 && !categories.some((item) => item.name.toLowerCase() === typed.toLowerCase());

  return (
    <section className="bg-card text-ink">
      <DialogHeader
        icon={<FolderPlus size={21} aria-hidden="true" />}
        eyebrow="Staff"
        title="Create a forum"
        lead="It goes live on the board straight away. Rename, reorder or lock it later in Admin → Forums."
      />
      <form
        className="space-y-5 px-6 py-6 sm:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await createForumInCategoryAction(formData);
            if (!result.ok) return setError(result.message);
            if (afterCreate === "open" && result.forumSlug) return router.push(`/forums/${result.forumSlug}`);
            toast(result.message, "success");
            onDone();
            router.refresh();
          });
        }}
      >
        <div className="space-y-2 text-sm">
          <label htmlFor="create-forum-category" className="font-semibold">
            Category
          </label>
          <input
            id="create-forum-category"
            name="categoryName"
            required
            minLength={2}
            maxLength={80}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Pick one below or type a new category"
            className="input w-full"
            autoComplete="off"
          />
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Existing categories">
              {categories.map((item) => {
                const selected = item.name.toLowerCase() === typed.toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategory(item.name)}
                    className={
                      selected
                        ? "rounded-full border border-accent bg-accent/15 px-3 py-1 text-xs font-bold text-accent-bright"
                        : "rounded-full border border-line bg-ink/[0.03] px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                    }
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted">
            {isNewCategory ? (
              <>
                A new category <strong className="text-ink">{typed}</strong> will be created.
              </>
            ) : (
              "Pick an existing category, or type a new name to create one."
            )}
          </p>
        </div>
        <label className="block space-y-2 text-sm">
          <span className="font-semibold">Forum name</span>
          <input name="name" required minLength={2} maxLength={80} placeholder="e.g. Redstone Engineers" className="input w-full" />
        </label>
        <label className="block space-y-2 text-sm">
          <span className="font-semibold">
            Description <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea name="description" maxLength={200} rows={3} placeholder="What is it for?" className="input w-full resize-y" />
        </label>
        <Notice message={error} />
        <div className="flex justify-end border-t border-line pt-5">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {pending ? "Creating…" : "Create forum"}
          </button>
        </div>
      </form>
    </section>
  );
}

/** "New category" and its dialog — the admin's counterpart to Create a forum. */
export function NewCategoryButton() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setVersion((value) => value + 1);
          setOpen(true);
        }}
      >
        <FolderPlus size={15} /> New category
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label="New category" size="compact">
        <NewCategory key={version} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function NewCategory({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  return (
    <section className="bg-card text-ink">
      <DialogHeader
        icon={<FolderPlus size={21} aria-hidden="true" />}
        eyebrow="Staff"
        title="New category"
        lead="Categories group forums on the board. It appears once it has a forum in it."
      />
      <form
        className="space-y-5 px-6 py-6 sm:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await createCategoryAction(formData);
            if (!result.ok) return setError(result.message);
            toast(result.message, "success");
            onDone();
            router.refresh();
          });
        }}
      >
        <label className="block space-y-2 text-sm">
          <span className="font-semibold">Category name</span>
          <input name="name" required minLength={2} maxLength={80} placeholder="e.g. Creative" className="input w-full" />
        </label>
        <label className="block space-y-2 text-sm">
          <span className="font-semibold">
            Description <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea name="description" maxLength={200} rows={3} placeholder="What belongs here?" className="input w-full resize-y" />
        </label>
        <Notice message={error} />
        <div className="flex justify-end border-t border-line pt-5">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {pending ? "Creating…" : "Create category"}
          </button>
        </div>
      </form>
    </section>
  );
}
