"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link as LinkIcon, Lock, LogIn, Send, Sparkles, Trash2, UploadCloud, UserCheck, UserPlus, X } from "lucide-react";
import { submitGalleryAction } from "@/lib/actions/gallery";
import { AuthDialogTrigger } from "@/components/auth/auth-dialog-provider";
import { Input, Textarea, useToast } from "@/components/ui";
import { cleanAndUnwrapImageUrl } from "@/lib/utils";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function GallerySubmitModal({
  isOpen,
  onClose,
  isLoggedIn = false,
  accountName = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn?: boolean;
  accountName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("builds");
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? dialogRef.current)?.focus();
    });
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handler);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!isLoggedIn) {
    return createPortal(
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-auth-title"
          className="relative w-full max-w-md flex flex-col rounded-2xl border border-line/80 bg-card text-ink shadow-2xl overflow-hidden animate-scale-up p-6 text-center space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/20 border border-accent/40 text-accent-bright">
            <Lock size={28} />
          </div>
          <div className="space-y-2">
            <h3 id="gallery-auth-title" className="font-display text-xl font-bold text-ink">Account Required</h3>
            <p className="text-muted text-xs leading-relaxed">
              You need a Mazora account to submit screenshots to the gallery. Please log in or create a new account to continue.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <AuthDialogTrigger
                view="login"
                next="/gallery"
                onOpen={onClose}
                className="btn btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl"
              >
                <LogIn size={15} /> Log In
              </AuthDialogTrigger>
              <AuthDialogTrigger
                view="register"
                next="/gallery"
                onOpen={onClose}
                className="btn btn-secondary text-xs py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl border border-line/80 bg-surface hover:bg-card text-ink"
              >
                <UserPlus size={15} /> Create Account
              </AuthDialogTrigger>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost text-xs py-2 text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please select a valid image file (PNG, JPG, WEBP).", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast("Image file size should be under 5MB.", "error");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setImageUrl("");
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (formData: FormData) => {
    if (!imageUrl) {
      toast("Please choose an image file or paste an image URL.", "error");
      return;
    }

    startTransition(async () => {
      const res = await submitGalleryAction(formData);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        handleClearImage();
        onClose();
      }
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-submit-title"
        className="relative w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl border border-line/80 bg-card text-ink shadow-2xl overflow-hidden animate-scale-up max-h-[92vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-4 bg-surface/80">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent-bright">
              <Sparkles size={18} />
            </span>
            <h3 id="gallery-submit-title" className="font-display text-lg font-bold text-ink">Submit Community Artwork</h3>
          </div>
          <button
            type="button"
            aria-label="Close artwork submission"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} />
          </button>
        </div>

        <form action={handleSubmit} className="p-4 sm:p-6 space-y-4 text-sm overflow-y-auto">
          <p className="text-muted text-xs leading-relaxed">
            Share your Minecraft builds, epic moments, or artwork with the Mazora community! Submissions will be reviewed by staff before appearing live.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="gallery-artwork-title" className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Artwork Title <span className="text-accent-bright">*</span>
            </label>
            <Input
              id="gallery-artwork-title"
              name="title"
              placeholder="e.g. Dragon Citadel Fortress"
              required
              className="bg-surface border-line/80 text-ink placeholder:text-muted focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="gallery-artwork-category" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Category
              </label>
              <select
                id="gallery-artwork-category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-xl border border-line/80 bg-surface px-3 text-sm text-ink focus:outline-none focus:border-accent"
              >
                <option value="builds">Player Builds</option>
                <option value="events">Events &amp; Bosses</option>
                <option value="spawns">Spawns &amp; Hubs</option>
                <option value="community">Community Moments</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Author Account Name
              </label>
              <div className="relative flex items-center">
                <Input
                  value={accountName}
                  readOnly
                  disabled
                  className="truncate bg-surface border-line/80 text-ink cursor-not-allowed font-medium pr-24 opacity-90"
                />
                <span className="absolute right-2.5 inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider bg-accent/20 border border-accent/40 text-accent-bright px-2 py-0.5 rounded-md">
                  <UserCheck size={11} /> Account
                </span>
              </div>
              <input type="hidden" name="authorName" value={accountName} />
              <p className="text-[0.68rem] text-muted">Author name is automatically set to your logged-in account.</p>
            </div>
          </div>

          {/* Hidden Image inputs */}
          <input
            ref={fileInputRef}
            type="file"
            name="imageFile"
            id="artwork-file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <input type="hidden" name="imageUrl" value={imageUrl && !imageUrl.startsWith("data:image/") ? imageUrl : ""} />

          {/* Upload Method Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Artwork Image <span className="text-accent-bright">*</span>
              </label>
              <div className="flex items-center gap-1 rounded-lg bg-surface p-0.5 border border-line/70">
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  aria-pressed={mode === "upload"}
                  className={`px-2.5 py-1 text-[0.7rem] font-semibold rounded-md flex items-center gap-1.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    mode === "upload" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  <UploadCloud size={12} /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setMode("url")}
                  aria-pressed={mode === "url"}
                  className={`px-2.5 py-1 text-[0.7rem] font-semibold rounded-md flex items-center gap-1.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    mode === "url" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  <LinkIcon size={12} /> Direct URL
                </button>
              </div>
            </div>

            {mode === "upload" ? (
              <div>
                <label
                  htmlFor="artwork-file"
                  className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-line hover:border-accent/50 rounded-xl bg-surface/50 hover:bg-surface transition-all cursor-pointer text-center group"
                >
                  <div className="h-10 w-10 rounded-full bg-accent/15 text-accent-bright flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <UploadCloud size={20} />
                  </div>
                  <span className="text-xs font-semibold text-ink">
                    {fileName ? fileName : "Click to choose image file"}
                  </span>
                  <span className="text-[0.7rem] text-muted mt-0.5">
                    Supports PNG, JPG, or WEBP (Max 5MB)
                  </span>
                </label>
              </div>
            ) : (
              <Input
                id="gallery-artwork-url"
                aria-label="Artwork image URL"
                placeholder="Paste image link or Google/Imgur URL..."
                value={imageUrl && !imageUrl.startsWith("data:image/") ? imageUrl : ""}
                onChange={(e) => {
                  setFileName("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                  setImageUrl(cleanAndUnwrapImageUrl(e.target.value));
                }}
                className="bg-surface border-line/80 text-ink placeholder:text-muted focus:border-accent"
              />
            )}

            {/* Live Image Preview */}
            {imageUrl && (
              <div className="relative mt-3 aspect-video w-full rounded-xl overflow-hidden border border-white/20 bg-black/60 shadow-inner flex items-center justify-center group">
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white backdrop-blur-md text-[0.65rem] font-bold px-2.5 py-1 shadow-md border border-rose-400/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="Remove selected image"
                >
                  <Trash2 size={12} /> Remove
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="h-full w-full object-contain object-center bg-black/70 p-1 transition-transform duration-300 group-hover:scale-[1.03]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  onLoad={(e) => { (e.target as HTMLImageElement).style.display = ""; }}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gallery-artwork-description" className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Description (Optional)
            </label>
            <Textarea
              id="gallery-artwork-description"
              name="description"
              rows={2}
              placeholder="Tell us about this build or artwork..."
              className="bg-surface border-line/80 text-ink placeholder:text-muted focus:border-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line/60">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost text-xs py-2 px-4 text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !imageUrl}
              className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2"
            >
              {pending ? (
                "Submitting..."
              ) : (
                <>
                  <Send size={14} /> Submit Artwork
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
