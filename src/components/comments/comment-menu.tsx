"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "⋯" menu holding Edit, Remove and Report. Renders nothing when the
 * viewer has none of them. Closes on Escape, on an outside click, and after a
 * choice.
 *
 * The items stay mounted while the menu is closed (only hidden). Report opens
 * a dialog owned by its button; unmounting the button on close would destroy
 * that dialog the instant it opened.
 */
export function CommentMenu({ items }: { items: { key: string; node: ReactNode }[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="comment-action"
      >
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      <div
        id={menuId}
        data-comment-menu
        className={cn(
          "absolute left-0 top-full z-30 mt-1 min-w-40 gap-0.5 rounded-xl border border-line bg-card p-1.5 shadow-xl shadow-black/30",
          open ? "grid" : "hidden",
        )}
        onClick={() => setOpen(false)}
      >
        {items.map((item) => (
          <div key={item.key} className="comment-menu-item">
            {item.node}
          </div>
        ))}
      </div>
    </div>
  );
}
