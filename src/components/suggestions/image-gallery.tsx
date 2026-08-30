"use client";

import { useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui";
import { deleteSuggestionImageAction } from "@/lib/actions/suggestions";
import type { SuggestionImage } from "@/lib/data/suggestions-board";

/** Within the 96–128px thumbnail size the surrounding layout expects. */
const THUMB_PX = 112;

/**
 * Thumbnail grid for a suggestion's or a reply's attached images.
 *
 * Renders nothing when `images` is empty — callers (ThreadView, ReplyItem)
 * mount this unconditionally under every body, so an empty post shows no
 * gallery at all rather than an empty grid shell.
 *
 * `canRemove` gates the per-thumbnail delete control. It is a plain boolean,
 * not re-derived here: the caller passes the same value it already computed
 * from `suggestions-rules.ts` for its own Edit/Delete controls, so this
 * component never re-implements (and can never disagree with) that
 * permission logic — `deleteSuggestionImageAction` is the real enforcement
 * either way.
 */
export function ImageGallery({
  images,
  canRemove = false,
}: {
  images: SuggestionImage[];
  canRemove?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  if (images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  function remove(imageId: string) {
    startTransition(async () => {
      const result = await deleteSuggestionImageAction({ imageId });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {sorted.map((image, index) => (
        <li
          key={image.id}
          className="group relative overflow-hidden rounded-xl border border-line bg-surface"
        >
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-24 w-full sm:h-28"
          >
            <Image
              src={image.url}
              alt={`Attached image ${index + 1}`}
              width={THUMB_PX}
              height={THUMB_PX}
              className="h-24 w-full object-cover sm:h-28"
            />
          </a>
          {canRemove && (
            <button
              type="button"
              onClick={() => remove(image.id)}
              disabled={pending}
              aria-label="Remove image"
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-page backdrop-blur-sm transition-colors hover:bg-ink/85 disabled:opacity-60"
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
