"use client";

import { useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { AlertTriangle, Check, ChevronDown, Link2, Loader2, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { SocialIcon } from "@/components/admin/social-icons";
import {
  saveCreatorCode,
  deleteCreatorCode,
  type CreatorCodeActionResult,
} from "@/lib/actions/creator-codes";
import type { CreatorCode, CreatorCodeStats } from "@/lib/data/creator-codes";
import { SOCIAL_PLATFORMS, socialLabel, type CreatorSocial, type SocialPlatform } from "@/lib/creator-socials";
import type { GameMode, Product } from "@/lib/types";
import { AdminTable, type Column } from "@/components/admin/admin-table";
import { useExampleCreator } from "@/lib/example-names";
import { FormRow, Input, Modal, Textarea, useToast } from "@/components/ui";
import { usd } from "@/lib/utils";

/**
 * Creator discount codes: issue a code to a vetted creator, pick exactly which
 * products it discounts, and see the business each one drove.
 *
 * Eligibility is hand-picked per code rather than category-wide, so adding a new
 * product never silently starts discounting it.
 */

const initialResult: CreatorCodeActionResult = { ok: false };

interface Draft {
  id?: string;
  code: string;
  /** True once the admin types their own code, which stops auto-generation. */
  codeEdited: boolean;
  creatorName: string;
  discordUsername: string;
  percentOff: string;
  enabled: boolean;
  /** "YYYY-MM-DD" from the date input, or "" for no expiry. */
  expiresAt: string;
  internalNote: string;
  socials: CreatorSocial[];
  productIds: string[];
}

const emptyDraft: Draft = {
  code: "",
  codeEdited: false,
  creatorName: "",
  discordUsername: "",
  percentOff: "15",
  enabled: true,
  expiresAt: "",
  internalNote: "",
  socials: [],
  productIds: [],
};

/**
 * "NovaPlays" -> "NOVAPLAYS1", then "NOVAPLAYS2" for the next code on that name.
 *
 * The number is a counter, deliberately NOT the discount percentage. A code
 * built from the percentage would silently change when the discount is edited —
 * NOVAPLAYS50 becoming NOVAPLAYS40 — breaking every link the creator has put
 * in a video description. The counter also settles same-name collisions on its
 * own, so there is no separate suffix step.
 */
function generateCode(creatorName: string, taken: Set<string>): string {
  const name = creatorName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 36);
  if (!name) return "";
  for (let n = 1; n < 1000; n += 1) {
    const candidate = `${name}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Astronomically unlikely; the server's unique index is still the backstop.
  return name;
}

/** Custom platform dropdown: a native <select> renders an unthemeable OS menu. */
function PlatformPicker({
  value,
  used,
  onChange,
}: {
  value: SocialPlatform;
  used: Set<SocialPlatform | undefined>;
  onChange: (platform: SocialPlatform) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="creator-code-platform" ref={wrapRef}>
      <button
        type="button"
        className="creator-code-platform-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SocialIcon platform={value} />
        <span className="flex-1 truncate text-left">{socialLabel(value)}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {open && (
        <ul className="creator-code-platform-menu" role="listbox">
          {SOCIAL_PLATFORMS.map((item) => {
            const taken = item.key !== value && used.has(item.key);
            return (
              <li key={item.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.key === value}
                  disabled={taken}
                  className={`creator-code-platform-item ${item.key === value ? "is-on" : ""}`}
                  onClick={() => {
                    onChange(item.key);
                    setOpen(false);
                  }}
                >
                  <SocialIcon platform={item.key} />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  {item.key === value && <Check size={13} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function toDraft(code: CreatorCode): Draft {
  return {
    id: code.id,
    code: code.code,
    // An existing code keeps whatever it was saved as; regenerating it silently
    // would break links creators have already published.
    codeEdited: true,
    creatorName: code.creatorName,
    discordUsername: code.discordUsername ?? "",
    percentOff: String(code.percentOff),
    enabled: code.enabled,
    /*
      Sliced from the stored ISO string, not re-rendered through
      toLocaleDateString: that formatted the instant in the ADMIN's zone while
      the server parsed the value back in its own (UTC on Vercel). A stored
      2026-09-01T23:59:59Z showed as 2026-09-02 to an admin at UTC+5:30, so
      re-saving an untouched date walked the expiry forward a day each time.
    */
    expiresAt: code.expiresAt ? String(code.expiresAt).slice(0, 10) : "",
    internalNote: code.internalNote ?? "",
    socials: code.socials.map((item) => ({ ...item })),
    productIds: [...code.productIds],
  };
}

function isExpired(code: CreatorCode): boolean {
  return Boolean(code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now());
}

export function CreatorCodesManager({
  codes,
  products,
  modes,
  stats,
}: {
  codes: CreatorCode[];
  products: Product[];
  modes: GameMode[];
  stats: Record<string, CreatorCodeStats>;
}) {
  const exampleCreator = useExampleCreator();
  const [saveState, saveAction, savePending] = useActionState(saveCreatorCode, initialResult);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCreatorCode, initialResult);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (saveState.ok && saveState.message) {
      toast(saveState.message, "success");
      setDraft(null);
    } else if (!saveState.ok && saveState.message) {
      toast(saveState.message, "error");
    }
  }, [saveState, toast]);

  useEffect(() => {
    if (deleteState.message) {
      toast(deleteState.message, deleteState.ok ? "success" : "error");
      if (deleteState.ok) setConfirmingDelete(null);
    }
  }, [deleteState, toast]);

  /** Products grouped mode → category, so the picker mirrors the storefront. */
  const grouped = useMemo(() => {
    const byMode = new Map<string, Map<string, Product[]>>();
    for (const product of products) {
      if (!product.id) continue;
      const modeSlug = product.gameModeSlug ?? "survival-smp";
      const categories = byMode.get(modeSlug) ?? new Map<string, Product[]>();
      const list = categories.get(product.category) ?? [];
      list.push(product);
      categories.set(product.category, list);
      byMode.set(modeSlug, categories);
    }
    return byMode;
  }, [products]);

  const modeName = (slug: string) => modes.find((mode) => mode.slug === slug)?.name ?? slug;

  /** Codes already in use, excluding the one being edited. */
  const takenCodes = useMemo(
    () => new Set(codes.filter((code) => code.id !== draft?.id).map((code) => code.code)),
    [codes, draft?.id],
  );

  /** The code shown and saved: generated until the admin overrides it. */
  const effectiveCode = (value: Draft) =>
    value.codeEdited ? value.code : generateCode(value.creatorName, takenCodes);

  const submit = () => {
    if (!draft) return;
    const data = new FormData();
    if (draft.id) data.append("id", draft.id);
    data.append("code", effectiveCode(draft));
    data.append("creatorName", draft.creatorName);
    data.append("discordUsername", draft.discordUsername);
    data.append("percentOff", draft.percentOff);
    data.append("enabled", draft.enabled ? "true" : "false");
    /*
      A bare "YYYY-MM-DD" parses as UTC midnight, which would expire the code
      partway through the chosen day. The explicit Z pins it to the end of that
      calendar day in UTC, which is also how the editor reads it back above — so
      the value round-trips unchanged no matter where the admin is.
    */
    data.append("expiresAt", draft.expiresAt ? `${draft.expiresAt}T23:59:59Z` : "");
    data.append("internalNote", draft.internalNote);
    data.append("socials", JSON.stringify(draft.socials.filter((item) => item.url.trim())));
    data.append("productIds", JSON.stringify(draft.productIds));
    startTransition(() => saveAction(data));
  };

  const remove = (id: string) => {
    const data = new FormData();
    data.append("id", id);
    startTransition(() => deleteAction(data));
  };

  /** Row-level kill switch: ending a sponsorship should be one click. */
  const togglePaused = (code: CreatorCode) => {
    const data = new FormData();
    data.append("id", code.id);
    data.append("code", code.code);
    data.append("creatorName", code.creatorName);
    data.append("discordUsername", code.discordUsername ?? "");
    data.append("percentOff", String(code.percentOff));
    data.append("enabled", code.enabled ? "false" : "true");
    data.append("expiresAt", code.expiresAt ?? "");
    data.append("internalNote", code.internalNote ?? "");
    data.append("socials", JSON.stringify(code.socials));
    data.append("productIds", JSON.stringify(code.productIds));
    startTransition(() => saveAction(data));
  };

  const toggleProduct = (id: string) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            productIds: current.productIds.includes(id)
              ? current.productIds.filter((item) => item !== id)
              : [...current.productIds, id],
          }
        : current,
    );

  const toggleGroup = (ids: string[], allSelected: boolean) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            productIds: allSelected
              ? current.productIds.filter((item) => !ids.includes(item))
              : [...new Set([...current.productIds, ...ids])],
          }
        : current,
    );

  const columns: Column<CreatorCode>[] = [
    {
      header: "Code",
      cell: (code) => (
        <span>
          <span className="telemetry block font-bold text-accent-bright">{code.code}</span>
          <span className="block text-xs text-muted">{code.creatorName}</span>
          {code.socials.length > 0 && (
            <span className="creator-code-social-links" aria-label={`${code.creatorName} social links`}>
              {code.socials.map((social) => (
                <a
                  key={`${social.platform}-${social.url}`}
                  href={social.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="creator-code-social-link"
                  aria-label={`Open ${code.creatorName}'s ${socialLabel(social.platform)}`}
                  title={`${socialLabel(social.platform)} · ${social.url}`}
                >
                  <SocialIcon platform={social.platform} size={14} />
                </a>
              ))}
            </span>
          )}
        </span>
      ),
    },
    {
      header: "Discount",
      cell: (code) => (
        <span>
          <span className="block font-bold">{code.percentOff}%</span>
          {code.productIds.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-warning">
              <AlertTriangle size={11} aria-hidden="true" /> no products
            </span>
          ) : (
            <span className="block text-xs text-muted">{code.productIds.length} products</span>
          )}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (code) => {
        if (isExpired(code)) {
          return (
            <span>
              <span className="block text-danger">Expired</span>
              <span className="block text-xs text-muted">
                {new Date(code.expiresAt!).toLocaleDateString()}
              </span>
            </span>
          );
        }
        return (
          <span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => togglePaused(code)}
              aria-label={code.enabled ? `Pause ${code.code}` : `Activate ${code.code}`}
            >
              {code.enabled ? (
                <span className="text-success">● Active</span>
              ) : (
                <span className="text-muted">● Paused</span>
              )}
            </button>
            <span className="block text-xs text-muted">
              {code.expiresAt ? `until ${new Date(code.expiresAt).toLocaleDateString()}` : "no expiry"}
            </span>
          </span>
        );
      },
    },
    {
      header: "Performance",
      align: "right",
      cell: (code) => {
        const entry = stats[code.id];
        if (!entry) return <span className="text-muted">—</span>;
        return (
          <span>
            <span className="block" title="Confirmed of total placed">
              {entry.confirmed} / {entry.placed} orders
            </span>
            {entry.confirmed > 0 && (
              <span className="block text-xs text-muted">
                {usd(entry.revenue)} · −{usd(entry.discountGiven)}
              </span>
            )}
          </span>
        );
      },
    },
    {
      header: "Actions",
      align: "right",
      cell: (code) =>
        confirmingDelete === code.id ? (
          <span className="flex items-center justify-end gap-1.5">
            <span className="text-xs text-muted">Delete?</span>
            <button
              type="button"
              className="btn btn-sm text-danger"
              disabled={deletePending}
              onClick={() => remove(code.id)}
            >
              {deletePending ? <Loader2 size={13} className="animate-spin" /> : "Yes, delete"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingDelete(null)}>
              Cancel
            </button>
          </span>
        ) : (
          <span className="flex items-center justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(code))}>
              <Pencil size={13} aria-hidden="true" /> Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-danger"
              onClick={() => setConfirmingDelete(code.id)}
            >
              <Trash2 size={13} aria-hidden="true" /> Delete
            </button>
          </span>
        ),
    },
  ];

  const usedPlatforms = new Set(draft?.socials.map((item) => item.platform));
  const previewCode = draft ? effectiveCode(draft) : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="creator-code-page-intro text-sm">
          A code takes a percentage off only the products picked for it. Deleting a code keeps past orders intact.
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft({ ...emptyDraft })}>
          <Plus size={15} aria-hidden="true" /> New code
        </button>
      </div>

      {codes.length === 0 ? (
        <div className="creator-code-empty panel p-8 text-center">
          <p className="font-display text-base font-bold">No discount codes yet</p>
          <p className="mt-1 text-sm text-muted">
            Create one for an approved creator, then pick the products it discounts.
          </p>
        </div>
      ) : (
        <AdminTable columns={columns} rows={codes} />
      )}

      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} label="Discount code" size="editor">
        {draft && (
          <div className="creator-code-editor store-admin-modal panel overflow-hidden">
            <header className="creator-code-editor-head">
              <h2 className="font-display text-lg font-bold">
                {draft.id ? "Edit discount code" : "New discount code"}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                The code is the creator&apos;s name plus a number. It stays the same if you change the
                discount later, so links they have already shared keep working.
              </p>
            </header>

            <div className="creator-code-editor-body">
            {/* --- Generated code preview ------------------------------------ */}
            <div className="creator-code-preview">
              <span className="creator-code-preview-label">
                <Wand2 size={13} aria-hidden="true" /> Code
              </span>
              <span className="creator-code-preview-value telemetry">
                {previewCode || <span className="text-muted">Enter a name first</span>}
              </span>
              {draft.codeEdited ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDraft({ ...draft, codeEdited: false })}
                >
                  Auto
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDraft({ ...draft, codeEdited: true, code: previewCode })}
                >
                  Customise
                </button>
              )}
            </div>
            {draft.codeEdited && (
              <FormRow label="Custom code" htmlFor="cc-code" error={saveState.errors?.code}>
                <Input
                  id="cc-code"
                  value={draft.code}
                  maxLength={40}
                  onChange={(event) =>
                    setDraft({ ...draft, code: event.target.value.toUpperCase().replace(/\s/g, "") })
                  }
                />
              </FormRow>
            )}
            {!draft.codeEdited && saveState.errors?.code && (
              <p className="text-xs font-semibold text-danger">{saveState.errors.code}</p>
            )}

            {/* --- Creator --------------------------------------------------- */}
            <section className="creator-code-section">
              <h3 className="creator-code-section-title">Creator</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Creator name" htmlFor="cc-name" error={saveState.errors?.creatorName}>
                  <Input
                    id="cc-name"
                    value={draft.creatorName}
                    maxLength={80}
                    placeholder={exampleCreator.name}
                    onChange={(event) => setDraft({ ...draft, creatorName: event.target.value })}
                  />
                </FormRow>
                <FormRow
                  label="Discord username"
                  htmlFor="cc-discord"
                  error={saveState.errors?.discordUsername}
                >
                  <Input
                    id="cc-discord"
                    value={draft.discordUsername}
                    maxLength={37}
                    placeholder={exampleCreator.handle}
                    onChange={(event) => setDraft({ ...draft, discordUsername: event.target.value })}
                  />
                </FormRow>
              </div>
            </section>

            {/* --- Discount -------------------------------------------------- */}
            <section className="creator-code-section">
              <h3 className="creator-code-section-title">Discount</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Percentage off" htmlFor="cc-percent" error={saveState.errors?.percentOff}>
                  <Input
                    id="cc-percent"
                    type="number"
                    min={1}
                    max={90}
                    value={draft.percentOff}
                    onChange={(event) => setDraft({ ...draft, percentOff: event.target.value })}
                  />
                </FormRow>
                <FormRow label="Expires (optional)" htmlFor="cc-expires" error={saveState.errors?.expiresAt}>
                  <Input
                    id="cc-expires"
                    type="date"
                    value={draft.expiresAt}
                    onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
                  />
                </FormRow>
              </div>
            </section>

            {/* --- Socials --------------------------------------------------- */}
            <section className="creator-code-section">
              <div className="flex items-center justify-between gap-3">
                <h3 className="creator-code-section-title">Social links</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={usedPlatforms.size >= SOCIAL_PLATFORMS.length}
                  onClick={() => {
                    const next = SOCIAL_PLATFORMS.find((item) => !usedPlatforms.has(item.key));
                    if (!next) return;
                    setDraft({ ...draft, socials: [...draft.socials, { platform: next.key, url: "" }] });
                  }}
                >
                  <Plus size={13} aria-hidden="true" /> Add link
                </button>
              </div>

              {draft.socials.length === 0 ? (
                <p className="text-xs text-muted">No links yet — add the channels this creator posts on.</p>
              ) : (
                <div className="space-y-2">
                  {draft.socials.map((social, index) => (
                    <div key={index} className="creator-code-social">
                      <PlatformPicker
                        value={social.platform}
                        used={usedPlatforms}
                        onChange={(platform) => {
                          const next = [...draft.socials];
                          next[index] = { ...social, platform };
                          setDraft({ ...draft, socials: next });
                        }}
                      />
                      <Input
                        aria-label={`${socialLabel(social.platform)} link`}
                        value={social.url}
                        placeholder="https://…"
                        maxLength={300}
                        onChange={(event) => {
                          const next = [...draft.socials];
                          next[index] = { ...social, url: event.target.value };
                          setDraft({ ...draft, socials: next });
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-danger"
                        aria-label={`Remove ${socialLabel(social.platform)} link`}
                        onClick={() =>
                          setDraft({ ...draft, socials: draft.socials.filter((_, i) => i !== index) })
                        }
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {saveState.errors?.socials && (
                <p className="text-xs font-semibold text-danger">{saveState.errors.socials}</p>
              )}
            </section>

            {/* --- Eligible products ----------------------------------------- */}
            <section className="creator-code-section">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="creator-code-section-title">Eligible products</h3>
                <span className="text-xs text-muted">{draft.productIds.length} selected</span>
              </div>
              {draft.productIds.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle size={13} aria-hidden="true" />
                  With nothing selected this code will discount nothing.
                </p>
              )}

              <div className="creator-code-picker">
                {[...grouped.entries()].map(([modeSlug, categories]) => (
                  <div key={modeSlug}>
                    <p className="creator-code-picker-mode">{modeName(modeSlug)}</p>
                    {[...categories.entries()].map(([category, list]) => {
                      const ids = list.map((product) => product.id!).filter(Boolean);
                      const allSelected = ids.every((id) => draft.productIds.includes(id));
                      return (
                        <div key={category} className="mt-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-muted">{category}</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleGroup(ids, allSelected)}
                            >
                              {allSelected ? "Clear all" : "Select all"}
                            </button>
                          </div>
                          <div className="mt-1 grid gap-1 sm:grid-cols-2">
                            {list.map((product) => {
                              const checked = draft.productIds.includes(product.id!);
                              return (
                                <label
                                  key={product.id}
                                  className={`creator-code-product ${checked ? "is-on" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={checked}
                                    onChange={() => toggleProduct(product.id!)}
                                  />
                                  <span className="creator-code-product-tick" aria-hidden="true">
                                    {checked && <Check size={11} />}
                                  </span>
                                  <span className="truncate">{product.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>

            <FormRow label="Internal note (staff only)" htmlFor="cc-note">
              <Textarea
                id="cc-note"
                rows={2}
                maxLength={500}
                value={draft.internalNote}
                onChange={(event) => setDraft({ ...draft, internalNote: event.target.value })}
              />
            </FormRow>
            </div>

            <footer className="creator-code-editor-foot">
              <span className="text-xs text-muted">
                <Link2 size={12} className="inline" aria-hidden="true" /> {draft.socials.length} link
                {draft.socials.length === 1 ? "" : "s"} · {draft.productIds.length} product
                {draft.productIds.length === 1 ? "" : "s"}
              </span>
              <span className="flex gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" disabled={savePending} onClick={submit}>
                  {savePending ? <Loader2 size={15} className="animate-spin" /> : "Save code"}
                </button>
              </span>
            </footer>
          </div>
        )}
      </Modal>
    </div>
  );
}
