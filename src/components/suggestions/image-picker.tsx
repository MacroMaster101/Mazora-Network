"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Link2 as LinkIcon, ImagePlus, X } from "lucide-react";
import {
  MAX_IMAGES_PER_POST,
  imageCountError,
  imageSizeError,
} from "@/lib/suggestion-image-rules";

/**
 * File picker for the suggestion/reply composers.
 *
 * The `<input type="file" name="images" multiple>` below is what actually
 * carries the chosen files into the surrounding `<form>`'s FormData — this
 * component only manages what that input's FileList holds (rebuilt through a
 * DataTransfer on every add/remove), so the composer's plain
 * `new FormData(form)` call needs no special-casing for images and the
 * server actions (which read the `images` field by name) see exactly what is
 * previewed here.
 *
 * Limits mirror the server exactly: MAX_IMAGES_PER_POST and the messages from
 * imageCountError/imageSizeError all come from suggestion-image-rules.ts, the
 * same module the Server Actions import — a rejection here is worded
 * identically to a rejection there. The per-file size check uses
 * SUGGESTION_MAX_IMAGE_BYTES (1 MB) via imageSizeError, not the looser
 * MAX_IMAGE_BYTES — that looser constant is image-store.ts's own outer
 * ceiling, not what this batch is actually held to under the hosting
 * platform's serverless request-body cap (see suggestion-image-rules.ts).
 */
/**
 * Hosts the browser is actually allowed to load an image from, mirroring the
 * `img-src` allowlist in lib/csp.ts. A pasted link from anywhere else is still
 * accepted and re-hosted on submit — the server fetch is not subject to the
 * page's CSP — but the browser cannot render a thumbnail for it here, so the
 * row shows the host instead of a deliberately broken image.
 *
 * Keep in step with lib/csp.ts; a host trusted there but missing here only
 * costs a preview, while the reverse renders a broken thumbnail.
 */
const PREVIEWABLE_HOSTS = [
  "mc-heads.net",
  "api.dicebear.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "googleusercontent.com",
  "supabase.co",
];

interface LinkPreview {
  raw: string;
  host: string;
  valid: boolean;
  previewable: boolean;
}

function describeLinks(value: string): LinkPreview[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      try {
        const url = new URL(raw);
        const valid = url.protocol === "http:" || url.protocol === "https:";
        const host = url.hostname;
        return {
          raw,
          host,
          valid,
          previewable:
            valid &&
            url.protocol === "https:" &&
            PREVIEWABLE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)),
        };
      } catch {
        return { raw, host: raw.slice(0, 40), valid: false, previewable: false };
      }
    });
}

export function ImagePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState("");
  const linkPreviews = describeLinks(urls);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const urlsId = useId();

  // Object URLs are only ever created here and must be revoked here too, both
  // when the file list changes and when the picker unmounts — otherwise every
  // add/remove cycle (and every navigation away mid-draft) leaks a blob URL.
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  // A native file input has no API for "here is the FileList I want it to
  // hold" beyond assigning a DataTransfer's .files — this is what lets
  // removing one thumbnail actually drop that file from what the form submits.
  function syncInput(next: File[]) {
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  // A form's native reset() clears the input's own FileList automatically,
  // but it does not touch this component's React state or the object URLs
  // built from it — without this listener the picker would keep showing
  // stale previews for files the form no longer holds after a successful post.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    function handleReset() {
      setFiles([]);
      setUrls("");
      setError(null);
    }
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    const combined = [...files, ...selected];
    const countMsg = imageCountError(combined.length);
    if (countMsg) {
      setError(countMsg);
      syncInput(files);
      return;
    }

    for (const file of selected) {
      const sizeMsg = imageSizeError(file.size);
      if (sizeMsg) {
        setError(sizeMsg);
        syncInput(files);
        return;
      }
    }

    setError(null);
    setFiles(combined);
    syncInput(combined);
  }

  function removeAt(index: number) {
    const next = files.filter((_, i) => i !== index);
    setError(null);
    setFiles(next);
    syncInput(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="btn btn-ghost btn-sm cursor-pointer">
          <ImagePlus size={14} aria-hidden="true" /> Add images
        </label>
        <span className="text-xs font-semibold text-muted">
          {files.length} / {MAX_IMAGES_PER_POST}
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name="images"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="sr-only"
      />

      {/* Image links. Submitted as `imageUrls`, one per line; the server
       *  fetches and RE-HOSTS each into our own bucket rather than hot-linking,
       *  so a thread never depends on someone else's host staying up and a
       *  member cannot swap the picture out afterwards. The fetch itself runs
       *  through the same SSRF-guarded path the news importer uses. Counted
       *  against the same 4-image cap as uploads. */}
      <div className="space-y-1">
        <label htmlFor={urlsId} className="text-xs font-semibold text-muted">
          Or paste image links — one per line
        </label>
        <textarea
          id={urlsId}
          name="imageUrls"
          rows={2}
          placeholder="https://example.com/screenshot.png"
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />

        {linkPreviews.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {linkPreviews.map((link, index) => (
              <li
                key={`${link.raw}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface/60 px-2 py-1.5"
              >
                {link.previewable ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={link.raw}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-ink/[0.06] text-muted">
                    <LinkIcon size={13} aria-hidden="true" />
                  </span>
                )}

                <span className="min-w-0 flex-1 truncate text-[0.7rem] text-muted">{link.host}</span>

                {link.valid ? (
                  <span className="shrink-0 text-[0.65rem] font-semibold text-muted">
                    {link.previewable ? "ready" : "will be fetched"}
                  </span>
                ) : (
                  <span className="shrink-0 text-[0.65rem] font-semibold text-danger">not a link</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      )}

      {previews.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {previews.map((src, index) => (
            <li
              key={src}
              className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface"
            >
              {/* Blob preview URLs can never go through next/image (no remote
               *  loader can resolve a blob: URL), so a plain <img> is correct
               *  here even though the gallery below uses next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Remove image"
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-page backdrop-blur-sm transition-colors hover:bg-ink/85"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
