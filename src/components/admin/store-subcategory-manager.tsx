"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, Edit3, Eye, EyeOff, Grid2X2, GripVertical, Layers3, List, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { GameMode, Product, StoreCategoryConfig, StoreSubcategoryConfig } from "@/lib/types";
import { deleteStoreSubcategoryAction, reorderStoreSubcategoriesAction, saveStoreSubcategoryAction, toggleStoreSubcategoryAction } from "@/lib/actions/store-settings";
import { FormRow, Input, Modal, Textarea, useToast } from "@/components/ui";
import { Icon } from "@/components/shared";
import { MODE_ICON_OPTIONS } from "@/components/admin/game-mode-form-modal";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function productSubcategory(product: Product) {
  return product.subcategory ?? product.billing ?? "";
}

export function StoreSubcategoryManager({ mode, category, products }: { mode: GameMode; category: StoreCategoryConfig; products: Product[] }) {
  const [draft, setDraft] = useState<StoreSubcategoryConfig | null | undefined>();
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [subcategoryIcon, setSubcategoryIcon] = useState(category.icon ?? "Layers");
  const [, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [subcatLayout, setSubcatLayout] = useState<"cards" | "rows">("cards");

  function open(item: StoreSubcategoryConfig | null) {
    setDraft(item);
    setName(item?.label ?? "");
    setSubcategoryIcon(item?.icon ?? category.icon ?? "Layers");
  }

  function submit(data: FormData) {
    start(async () => {
      const result = await saveStoreSubcategoryAction(data);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setDraft(undefined);
        window.location.reload();
      }
    });
  }

  function toggle(item: StoreSubcategoryConfig) {
    start(async () => {
      const data = new FormData();
      data.set("gameModeSlug", mode.slug);
      data.set("categoryKey", category.key);
      data.set("key", item.key);
      data.set("enabled", String(!item.enabled));
      const result = await toggleStoreSubcategoryAction(data);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) window.location.reload();
    });
  }

  function reorder(item: StoreSubcategoryConfig, direction: "up" | "down" | "drag", targetIndex?: number) {
    start(async () => {
      const data = new FormData();
      data.set("gameModeSlug", mode.slug);
      data.set("categoryKey", category.key);
      data.set("key", item.key);
      data.set("direction", direction);
      if (targetIndex !== undefined) {
        data.set("targetIndex", String(targetIndex));
      }
      const result = await reorderStoreSubcategoriesAction(data);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) window.location.reload();
    });
  }

  function remove(item: StoreSubcategoryConfig) {
    if (!window.confirm(`Delete ${item.label}? This cannot be undone.`)) return;
    start(async () => {
      const data = new FormData();
      data.set("gameModeSlug", mode.slug);
      data.set("categoryKey", category.key);
      data.set("key", item.key);
      const result = await deleteStoreSubcategoryAction(data);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) window.location.reload();
    });
  }

  const sorted = [...category.subcategories].sort((a, b) => a.sortOrder - b.sortOrder);

  const liveProductsCount = products.filter((product) => product.enabled !== false).length;

  return (
    <div className="store-admin-hierarchy mb-7">
      <div className="store-admin-flow-head">
        <div>
          <p className="eyebrow">Subcategory workflow</p>
          <h2>{category.label} subcategories.</h2>
          <p>Choose a subcategory to manage its items, or create another collection.</p>
        </div>
        <div className="store-admin-head-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => open(null)}><Plus size={15} /> New subcategory</button>
        </div>
      </div>
      <nav className="store-admin-breadcrumbs" aria-label="Store subcategory breadcrumb">
        <Link href="/admin/store/catalog"><b>01</b> Game modes</Link><ChevronRight size={14} />
        <Link href={`/admin/store/catalog/${mode.slug}`}><b>02</b> {mode.name}</Link><ChevronRight size={14} />
        <span className="is-current"><b>03</b> {category.label}</span><ChevronRight size={14} />
        <span><b>04</b> Items</span>
      </nav>
      <section className="store-admin-flow-section" aria-labelledby="store-subcategory-step">
        <div className="store-admin-flow-section-head">
          <div><span>03</span><div><h3 id="store-subcategory-step">Choose a subcategory</h3><p>{sorted.length} custom collections inside {category.label}.</p></div></div>
          <div className="flex items-center gap-3">
            <div className="store-admin-layout-toggle" aria-label="Subcategory layout">
              <button type="button" className={subcatLayout === "rows" ? "is-active" : ""} onClick={() => setSubcatLayout("rows")} title="Row view"><List size={16} /></button>
              <button type="button" className={subcatLayout === "cards" ? "is-active" : ""} onClick={() => setSubcatLayout("cards")} title="Card view"><Grid2X2 size={16} /></button>
            </div>
            <span className="store-admin-flow-count">{sorted.length + 1} subcategories</span>
          </div>
        </div>
        <div className={`store-admin-subcategory-picker ${subcatLayout === "cards" ? "is-card-layout" : "is-row-layout"}`}>
          {/* Default Built-in "All [Category Name]" Card */}
          <article className="store-admin-subcategory-card store-admin-subcategory-card-default border-2 border-violet-500/40 bg-violet-500/5">
            <div className="flex items-center justify-between p-3 pb-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/40">
                  DEFAULT
                </span>
                <span className="store-admin-badge-live inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" /> LIVE
                </span>
              </div>
              <span className="text-[10px] font-bold text-muted px-2 py-0.5 rounded border border-line">Built-in Collection</span>
            </div>

            <Link href={`/admin/store/catalog/${mode.slug}/${slugify(category.key)}/all`}>
              <span><Icon name={category.icon ?? "Layers"} size={20} /></span>
              <small>Default View</small>
              <h3>All {category.label}</h3>
              <p>View, search, and manage all {products.length} products in {category.label}.</p>
              <b>{liveProductsCount}/{products.length} live items</b>
              <em>Open all items <ChevronRight size={14} /></em>
            </Link>
            <div className="flex items-center gap-1.5 p-3 pt-0">
              <Link href={`/admin/store/catalog/${mode.slug}/${slugify(category.key)}/all`} className="btn btn-primary btn-sm w-full justify-center font-extrabold shadow-md">
                <Layers3 size={13} /> View All {category.label} Items
              </Link>
            </div>
          </article>

          {sorted.map((item, index) => {
            const count = products.filter((product) => productSubcategory(product) === item.key).length;
            const live = products.filter((product) => productSubcategory(product) === item.key && product.enabled !== false).length;
            const isLive = item.enabled !== false;
            const isDragOver = dragOverIndex === index;

            return (
              <article
                key={item.key}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", index.toString());
                  setDraggedIndex(index);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                  if (sourceIndex !== index && !isNaN(sourceIndex)) {
                    reorder(item, "drag", index);
                  }
                }}
                className={`store-admin-subcategory-card transition-all ${isLive ? "" : "is-disabled"} ${
                  isDragOver ? "border-2 border-violet-500 bg-violet-500/10 scale-[1.01] shadow-lg" : ""
                }`}
              >
                <div className="flex items-center justify-between p-3 pb-0">
                  <div className="flex items-center gap-1.5">
                    {/* Drag Grip Handle for PC / Laptop Drag and Drop */}
                    <span
                      className="cursor-grab active:cursor-grabbing text-muted hover:text-foreground p-0.5"
                      title="Drag to reorder subcategory"
                    >
                      <GripVertical size={16} />
                    </span>

                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-surface-hover border border-line text-foreground">
                      #{index + 1}
                    </span>
                    {isLive ? (
                      <span className="store-admin-badge-live inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" /> LIVE
                      </span>
                    ) : (
                      <span className="store-admin-badge-hidden inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-sm">
                        <EyeOff size={11} /> HIDDEN
                      </span>
                    )}
                  </div>

                  {/* Clean Move Left / Move Right Icon Controls */}
                  <div className="flex items-center rounded-lg border border-line bg-surface-hover/80 p-0.5 shadow-sm">
                    <button
                      type="button"
                      disabled={index === 0 || busy}
                      className="p-1 rounded hover:bg-surface text-foreground disabled:opacity-20 transition-colors"
                      onClick={() => reorder(item, "up")}
                      title="Move subcategory left"
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <span className="w-px h-3 bg-line mx-0.5" />
                    <button
                      type="button"
                      disabled={index === sorted.length - 1 || busy}
                      className="p-1 rounded hover:bg-surface text-foreground disabled:opacity-20 transition-colors"
                      onClick={() => reorder(item, "down")}
                      title="Move subcategory right"
                    >
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>

                <Link href={`/admin/store/catalog/${mode.slug}/${slugify(category.key)}/${slugify(item.key)}`}>
                  <span><Icon name={item.icon ?? category.icon ?? "Layers"} size={20} /></span>
                  <small>Subcategory</small>
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                  <b>{live}/{count} live items</b>
                  <em>Open items <ChevronRight size={14} /></em>
                </Link>
                <div className="flex items-center gap-1.5 p-3 pt-0">
                  <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => open(item)}><Edit3 size={13} /> Edit</button>
                  <button
                    type="button"
                    disabled={busy}
                    className={`btn btn-sm ${isLive ? "btn-secondary" : "btn-primary font-black shadow-md"}`}
                    onClick={() => toggle(item)}
                  >
                    {isLive ? <EyeOff size={13} /> : <Eye size={13} />}
                    {isLive ? "Hide" : "Enable"}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(item)}><Trash2 size={13} /> Delete</button>
                </div>
              </article>
            );
          })}
          {sorted.length === 0 && <div className="store-admin-empty-category panel"><Layers3 size={28} /><h3>No subcategories yet</h3><p>Create the first collection, then add products inside it.</p><button type="button" className="btn btn-primary btn-sm" onClick={() => open(null)}><Plus size={14} /> New subcategory</button></div>}
        </div>
      </section>
      <Modal open={draft !== undefined} onClose={() => setDraft(undefined)} label={draft ? "Edit Store subcategory" : "Create Store subcategory"} size="editor">
        {draft !== undefined && (
          <form key={`${category.key}:${draft?.key ?? "new-subcategory"}`} action={submit} className="store-admin-modal panel overflow-hidden">
            <div className="store-admin-modal-head border-b border-line px-6 py-5">
              <div><p className="eyebrow">{mode.name} · {category.label}</p><h2 className="mt-2 text-2xl font-black">{draft ? `Edit ${draft.label}` : "Create subcategory"}</h2></div>
              <div className="store-admin-form-steps" aria-label="Subcategory form sections"><span>Basics</span><span>Icon</span><span>Visibility</span></div>
            </div>
            <div className="store-admin-form-body grid gap-5 p-6 md:grid-cols-2">
              <input type="hidden" name="gameModeSlug" value={mode.slug} />
              <input type="hidden" name="categoryKey" value={category.key} />
              <input type="hidden" name="key" value={draft?.key ?? ""} />
              <input type="hidden" name="icon" value={subcategoryIcon} />

              <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-subcategory-basics">
                <header><span>01</span><div><h3 id="store-subcategory-basics">Subcategory basics</h3><p>Name and describe this collection. Its internal key and display order are generated automatically.</p></div></header>
                <div className="grid gap-5">
                  <FormRow label="Display name" htmlFor="subcategory-label"><Input id="subcategory-label" name="label" value={name} onChange={(event) => setName(event.target.value)} required /></FormRow>
                  <FormRow label="Description" htmlFor="subcategory-description"><Textarea id="subcategory-description" name="description" rows={3} defaultValue={draft?.description ?? "Products grouped inside this collection."} required /></FormRow>
                </div>
              </section>

              <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-subcategory-icon">
                <header><span>02</span><div><h3 id="store-subcategory-icon">Subcategory icon</h3><p>Used on collection cards and inherited by the products inside it.</p></div></header>
                <div className="store-admin-category-options">
                  {MODE_ICON_OPTIONS.map(({ value, label, icon: OptIcon }) => (
                    <label key={value} className={subcategoryIcon === value ? "is-selected" : ""}>
                      <input type="radio" name="iconChoice" value={value} checked={subcategoryIcon === value} onChange={() => setSubcategoryIcon(value)} />
                      <span><OptIcon size={17} /></span><strong>{label}</strong><small>{value}</small>
                    </label>
                  ))}
                </div>
              </section>

              <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-subcategory-visibility">
                <header><span>03</span><div><h3 id="store-subcategory-visibility">Visibility</h3><p>Control whether shoppers can open this collection.</p></div></header>
                <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold"><input type="checkbox" name="enabled" defaultChecked={draft?.enabled ?? true} /><span>Show this subcategory</span></label>
              </section>
            </div>
            <div className="store-admin-modal-actions flex justify-end gap-2 border-t border-line px-6 py-4">
              {draft && <button type="reset" className="btn btn-secondary mr-auto" onClick={() => open(draft)}><RotateCcw size={15} /> Reset changes</button>}
              <button type="button" className="btn btn-secondary" onClick={() => setDraft(undefined)}>Cancel</button>
              <button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : draft ? "Save subcategory" : "Create subcategory"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
