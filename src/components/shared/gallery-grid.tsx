"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Calendar,
  Camera,
  Compass,
  Gem,
  Heart,
  ImageOff,
  Maximize2,
  Pickaxe,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import type { GalleryImage } from "@/lib/types";
import { toggleGalleryLikeAction } from "@/lib/actions/gallery";
import { coverGradient } from "./accent";
import { fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui";

function GalleryCardImage({ img }: { img: GalleryImage }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [img.imageUrl]);

  if (error || !img.imageUrl) {
    return (
      <div
        className="h-full w-full flex flex-col items-center justify-center p-4 text-center space-y-2 relative overflow-hidden"
        style={{ backgroundImage: coverGradient(img.accent || "violet") }}
      >
        <div className="h-10 w-10 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/70">
          <Camera size={20} />
        </div>
        <span className="text-xs font-bold text-white/90 line-clamp-1 max-w-[85%]">{img.title}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.imageUrl}
      alt={img.title}
      onError={() => setError(true)}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

function AuthorAvatarThumb({ author, size = 20 }: { author: string; size?: number }) {
  const [error, setError] = useState(false);
  const isMazoraTeam = /^(the )?mazora (network|team)$/i.test(author.trim());

  if (isMazoraTeam) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/images/mazora-icon.png"
        alt={author}
        className={cn(
          "rounded-sm object-contain bg-accent/20 border border-accent/40",
          size > 24 ? "h-full w-full p-1" : "h-4 w-4"
        )}
      />
    );
  }

  if (error) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://mc-heads.net/avatar/${author}/${size}`}
      alt={author}
      className={cn(
        "rounded-sm object-cover",
        size > 24 ? "h-full w-full" : "h-4 w-4"
      )}
      onError={() => setError(true)}
    />
  );
}

function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (error || !src) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 text-white/70">
        <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
          <ImageOff size={24} />
        </div>
        <h4 className="font-bold text-sm text-white">Full Image Unavailable</h4>
        <p className="text-xs text-white/60 max-w-xs leading-relaxed">
          The original image URL couldn&apos;t be loaded directly by your browser.
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="max-h-[80vh] w-full object-contain"
    />
  );
}

const CATEGORY_MAP: Record<string, string> = {
  all: "All Artworks",
  builds: "Player Builds",
  events: "Events & Bosses",
  spawns: "Spawns & Hubs",
  community: "Community Moments",
};

const SECTIONS = [
  {
    key: "builds",
    title: "Player Builds",
    description: "Masterpiece castles, mega-structures, and intricate survival bases built by players.",
    icon: Pickaxe,
    iconColor: "text-amber-400",
    badgeBg: "bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-transparent border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
  },
  {
    key: "events",
    title: "Events & Bosses",
    description: "Server-wide Ender Dragon raids, PvP tournament finals, and seasonal festival battles.",
    icon: Swords,
    iconColor: "text-rose-400",
    badgeBg: "bg-gradient-to-br from-rose-500/20 via-red-500/15 to-transparent border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]",
  },
  {
    key: "spawns",
    title: "Spawns & Hubs",
    description: "Official realm spawns, floating skylands, and custom nether portal hubs.",
    icon: Compass,
    iconColor: "text-cyan-400",
    badgeBg: "bg-gradient-to-br from-cyan-500/20 via-sky-500/15 to-transparent border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]",
  },
  {
    key: "community",
    title: "Community Moments",
    description: "Player trading districts, guild fortresses, crystal caverns, and everyday SMP life.",
    icon: Gem,
    iconColor: "text-emerald-400",
    badgeBg: "bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-transparent border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
  },
];

function GalleryCard({
  img,
  onOpen,
  onLike,
}: {
  img: GalleryImage;
  onOpen: (img: GalleryImage) => void;
  onLike: (e: React.MouseEvent, id: string) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(img);
    }
  };

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => onOpen(img)}
      onKeyDown={handleKeyDown}
      className="gallery-public-card group relative flex flex-col overflow-hidden rounded-2xl cursor-pointer border border-line/60 bg-card text-ink transition-all duration-300 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      {/* Image Box */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/60">
        <GalleryCardImage img={img} />

        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {img.featured && (
            <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wider shadow-lg shadow-amber-500/20">
              <Sparkles size={11} /> Featured
            </span>
          )}
          <span className="rounded-full bg-black/75 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-white/90 border border-white/15 backdrop-blur-md shadow-md">
            {CATEGORY_MAP[img.category.toLowerCase()] || img.category}
          </span>
        </div>

        {/* Like Button & Maximize overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => onLike(e, img.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all backdrop-blur-md shadow-md border border-white/15 outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
              img.hasLiked
                ? "bg-rose-600 text-white border-rose-400/50 shadow-rose-600/30"
                : "bg-black/70 text-white/90 hover:bg-rose-600 hover:text-white hover:border-rose-500"
            )}
          >
            <Heart size={13} className={cn(img.hasLiked && "fill-current")} />
            <span>{img.likesCount}</span>
          </button>
        </div>

        <div className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/40">
          <Maximize2 size={24} className="text-white/0 transition-all group-hover:text-white/90 group-hover:scale-110" />
        </div>
      </div>

      {/* Bottom Info Box */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="card-title font-display text-lg leading-snug line-clamp-2 text-ink group-hover:text-accent transition-colors">
            {img.title}
          </h3>
          {img.description && (
            <p className="card-desc mt-2 text-sm line-clamp-2 leading-relaxed text-muted">
              {img.description}
            </p>
          )}
        </div>

        <div className="card-footer flex items-center justify-between border-t border-line/60 pt-3.5 text-sm">
          <span className="card-author flex items-center gap-2 text-ink/90 font-medium">
            <AuthorAvatarThumb author={img.author} size={22} />
            <span>by {img.author}</span>
          </span>
          <span className="text-xs text-muted">{fmtDate(img.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState("all");
  const [open, setOpen] = useState<GalleryImage | null>(null);
  const [items, setItems] = useState<GalleryImage[]>(images);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Lock body scroll and handle Escape key when lightbox modal is open */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Sync state if prop changes
  useMemo(() => {
    setItems(images);
  }, [images]);

  const filteredList = useMemo(() => {
    if (active === "all") return items;
    return items.filter((i) => i.category.toLowerCase() === active.toLowerCase());
  }, [items, active]);

  const handleLike = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    // Optimistic update
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nowLiked = !item.hasLiked;
          return {
            ...item,
            hasLiked: nowLiked,
            likesCount: Math.max(0, item.likesCount + (nowLiked ? 1 : -1)),
          };
        }
        return item;
      })
    );

    if (open && open.id === id) {
      const nowLiked = !open.hasLiked;
      setOpen({
        ...open,
        hasLiked: nowLiked,
        likesCount: Math.max(0, open.likesCount + (nowLiked ? 1 : -1)),
      });
    }

    startTransition(async () => {
      const res = await toggleGalleryLikeAction(id);
      if (!res.ok) {
        toast(res.message, "error");
        // Revert optimistic update if failed
        setItems(images);
      }
    });
  };

  return (
    <div className="space-y-10">
      {/* Category Filter Bar */}
      <div className="space-y-3 border-b border-white/15 pb-5">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_MAP).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-extrabold tracking-wide transition-all duration-200 border select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                active === key
                  ? "bg-accent text-white border-accent-bright shadow-lg shadow-accent/30"
                  : "bg-slate-950/70 text-slate-200 border-white/15 hover:bg-slate-900/90 hover:text-white hover:border-white/30 backdrop-blur-md"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs font-mono text-slate-300 font-semibold">
          Showing {filteredList.length} artwork{filteredList.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* When ALL is selected */}
      {active === "all" ? (
        items.length === 0 ? (
          /* Global Empty State when no items exist */
          <div className="panel group relative flex flex-col items-center justify-center p-8 sm:p-14 text-center rounded-3xl border border-line/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden my-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/40 bg-accent/20 text-accent-bright mb-4 shadow-lg shadow-accent/20 animate-pulse">
              <Sparkles size={30} />
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
              Community Artworks & Builds Coming Soon!
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Our community gallery showcase is fresh and ready for submissions! Be the first player to share your epic Minecraft builds, event captures, and community artworks with the Mazora network.
            </p>
          </div>
        ) : (
          <div className="space-y-14">
            {SECTIONS.map((sec) => {
              const secImages = items.filter((i) => i.category.toLowerCase() === sec.key);
              if (secImages.length === 0) return null;
              const latest6 = secImages.slice(0, 6);
              const Icon = sec.icon;

              return (
                <div key={sec.key} className="space-y-5">
                  {/* Section Header with Minecraft Motifs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-white/15 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-3.5">
                      {/* Minecraft-styled Icon Container */}
                      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-xl shadow-lg", sec.badgeBg)}>
                        <Icon size={22} className={sec.iconColor} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">{sec.title}</h2>
                          <span className="rounded-full bg-white/15 text-white border border-white/25 px-3 py-0.5 text-xs font-mono font-bold shadow-inner">
                            {secImages.length}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-200/90 font-medium mt-0.5 leading-snug">{sec.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActive(sec.key)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/70 hover:bg-accent text-white hover:border-accent-bright font-bold px-4 py-2.5 text-xs backdrop-blur-md shadow-lg transition-all shrink-0 self-start sm:self-auto group hover:scale-105 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span>View All ({secImages.length})</span>
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>

                  {/* Grid of Latest 6 Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {latest6.map((img) => (
                      <GalleryCard key={img.id} img={img} onOpen={setOpen} onLike={handleLike} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Single category tab view */
        <div>
          {filteredList.length === 0 ? (
            <div className="panel group relative flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-line/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden my-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent-bright mb-3.5 shadow-md">
                <Sparkles size={26} />
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-ink">No community artworks in this category yet</h3>
              <p className="mt-1.5 max-w-md text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Be the first player to showcase your creations in this realm category!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredList.map((img) => (
                <GalleryCard key={img.id} img={img} onOpen={setOpen} onLike={handleLike} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-2xl animate-fade-in"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row rounded-3xl border border-line/80 bg-card text-ink shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="absolute top-4 right-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white/80 hover:bg-white/20 hover:text-white backdrop-blur-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
              title="Close details (Esc)"
            >
              <X size={20} />
            </button>

            {/* Left: Full Image */}
            <div className="relative flex-1 bg-black/90 flex items-center justify-center min-h-[300px] md:min-h-[500px]">
              <LightboxImage src={open.imageUrl} alt={open.title} />
            </div>

            {/* Right Side: Details & Creator Box */}
            <div className="w-full md:w-80 flex flex-col p-6 bg-surface border-t md:border-t-0 md:border-l border-line/60 justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-accent-bright">
                    {CATEGORY_MAP[open.category.toLowerCase()] || open.category}
                  </span>
                  {open.featured && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[0.7rem] font-extrabold uppercase shadow-md">
                      <Sparkles size={11} /> Featured
                    </span>
                  )}
                </div>

                <h2 className="font-display font-bold text-xl leading-snug text-ink">{open.title}</h2>

                {open.description && (
                  <p className="text-sm text-muted leading-relaxed font-light">
                    {open.description}
                  </p>
                )}

                <div className="rounded-xl border border-line/60 bg-card/80 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line grid place-items-center bg-black/40">
                      <AuthorAvatarThumb author={open.author} size={40} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs uppercase tracking-wider text-muted">Uploaded by</span>
                      <span className="block font-bold text-sm text-ink truncate">{open.author}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted pt-2 border-t border-line/60">
                    <Calendar size={13} />
                    <span>Uploaded on {fmtDate(open.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Interactive Like Action */}
              <div className="pt-6 border-t border-line/60">
                <button
                  type="button"
                  onClick={(e) => handleLike(e, open.id)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                    open.hasLiked
                      ? "bg-rose-600 text-white shadow-rose-600/30"
                      : "bg-accent/10 text-accent-bright hover:bg-rose-600 hover:text-white"
                  )}
                >
                  <Heart size={18} className={cn(open.hasLiked && "fill-current")} />
                  <span>{open.hasLiked ? "Liked Artwork" : "Like Artwork"} ({open.likesCount})</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
