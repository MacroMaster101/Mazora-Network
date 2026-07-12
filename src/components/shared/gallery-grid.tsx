"use client";

import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { GalleryImage } from "@/lib/types";
import { Modal } from "@/components/ui";
import { coverGradient } from "./accent";
import { cn } from "@/lib/utils";

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(images.map((i) => i.category)))], [images]);
  const [active, setActive] = useState("All");
  const [open, setOpen] = useState<GalleryImage | null>(null);

  const list = active === "All" ? images : images.filter((i) => i.category === active);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              active === c ? "border-accent/50 bg-accent/10 text-accent-bright" : "border-line text-muted hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6 columns-2 gap-4 md:columns-3 [&>*]:mb-4">
        {list.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setOpen(img)}
            className="group relative block w-full overflow-hidden rounded-xl border border-line"
            style={{ backgroundImage: coverGradient(img.accent), height: `${180 + (i % 3) * 60}px` }}
          >
            <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/40">
              <Maximize2 size={22} className="text-white/0 transition-colors group-hover:text-white/90" />
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-left">
              <span className="block text-sm font-medium">{img.title}</span>
              <span className="text-xs text-white/60">by {img.author}</span>
            </span>
          </button>
        ))}
      </div>

      <Modal open={open !== null} onClose={() => setOpen(null)} label={open?.title}>
        {open && (
          <div className="panel overflow-hidden">
            <div className="h-[52vh]" style={{ backgroundImage: coverGradient(open.accent) }} />
            <div className="p-5">
              <h3 className="font-display text-lg font-bold">{open.title}</h3>
              <p className="text-sm text-muted">
                {open.category} · by {open.author}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
