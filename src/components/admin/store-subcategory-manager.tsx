"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Edit3, Eye, EyeOff, Layers3, Plus, Save, Trash2 } from "lucide-react";
import type { GameMode, Product, StoreCategoryConfig, StoreSubcategoryConfig } from "@/lib/types";
import { deleteStoreSubcategoryAction, saveStoreSubcategoryAction, toggleStoreSubcategoryAction } from "@/lib/actions/store-settings";
import { FormRow, Input, Modal, Textarea, useToast } from "@/components/ui";

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
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);

  function open(item: StoreSubcategoryConfig | null) {
    setDraft(item);
    setName(item?.label ?? "");
    setKey(item?.key ?? "");
    setKeyTouched(Boolean(item));
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
        <Link href="/admin/store"><b>01</b> Game modes</Link><ChevronRight size={14} />
        <Link href={`/admin/store/${mode.slug}`}><b>02</b> {mode.name}</Link><ChevronRight size={14} />
        <span className="is-current"><b>03</b> {category.label}</span><ChevronRight size={14} />
        <span><b>04</b> Items</span>
      </nav>
      <section className="store-admin-flow-section" aria-labelledby="store-subcategory-step">
        <div className="store-admin-flow-section-head">
          <div><span>03</span><div><h3 id="store-subcategory-step">Choose a subcategory</h3><p>{sorted.length} collections inside {category.label}.</p></div></div>
          <small>{products.length} category items</small>
        </div>
        <div className="store-admin-subcategory-picker">
          {sorted.map((item) => {
            const count = products.filter((product) => productSubcategory(product) === item.key).length;
            const live = products.filter((product) => productSubcategory(product) === item.key && product.enabled !== false).length;
            return (
              <article key={item.key} className={`store-admin-subcategory-card ${item.enabled ? "" : "is-disabled"}`}>
                <Link href={`/admin/store/${mode.slug}/${slugify(category.key)}/${slugify(item.key)}`}>
                  <span><Layers3 size={20} /></span>
                  <small>Subcategory</small>
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                  <b>{live}/{count} live items</b>
                  <em>Open items <ChevronRight size={14} /></em>
                </Link>
                <div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => open(item)}><Edit3 size={14} /> Edit</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggle(item)}>{item.enabled ? <EyeOff size={14} /> : <Eye size={14} />}{item.enabled ? "Hide" : "Enable"}</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(item)}><Trash2 size={14} /> Delete</button>
                </div>
              </article>
            );
          })}
          {sorted.length === 0 && <div className="store-admin-empty-category panel"><Layers3 size={28} /><h3>No subcategories yet</h3><p>Create the first collection, then add products inside it.</p><button type="button" className="btn btn-primary btn-sm" onClick={() => open(null)}><Plus size={14} /> New subcategory</button></div>}
        </div>
      </section>
      <Modal open={draft !== undefined} onClose={() => setDraft(undefined)} label={draft ? "Edit Store subcategory" : "Create Store subcategory"}>
        {draft !== undefined && (
          <form action={submit} className="store-admin-modal panel overflow-hidden">
            <div className="store-admin-modal-head border-b border-line px-6 py-5">
              <div><p className="eyebrow">{mode.name} · {category.label}</p><h2 className="mt-2 text-2xl font-black">{draft ? `Edit ${draft.label}` : "Create subcategory"}</h2></div>
            </div>
            <div className="grid gap-5 p-6 md:grid-cols-2">
              <input type="hidden" name="gameModeSlug" value={mode.slug} />
              <input type="hidden" name="categoryKey" value={category.key} />
              <FormRow label="Display name" htmlFor="subcategory-label"><Input id="subcategory-label" name="label" value={name} onChange={(event) => { setName(event.target.value); if (!keyTouched) setKey(event.target.value); }} required /></FormRow>
              <FormRow label="Internal key" htmlFor="subcategory-key" hint="Used to assign products"><Input id="subcategory-key" name="key" value={key} onChange={(event) => { setKeyTouched(true); setKey(event.target.value); }} readOnly={Boolean(draft)} required /></FormRow>
              <div className="md:col-span-2"><FormRow label="Description" htmlFor="subcategory-description"><Textarea id="subcategory-description" name="description" rows={3} defaultValue={draft?.description ?? "Products grouped inside this collection."} required /></FormRow></div>
              <FormRow label="Display order" htmlFor="subcategory-order"><Input id="subcategory-order" name="sortOrder" type="number" defaultValue={draft?.sortOrder ?? sorted.length * 10} /></FormRow>
              <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold"><input type="checkbox" name="enabled" defaultChecked={draft?.enabled ?? true} /><span>Show this subcategory</span></label>
            </div>
            <div className="store-admin-modal-actions flex justify-end gap-2 border-t border-line px-6 py-4"><button type="button" className="btn btn-secondary" onClick={() => setDraft(undefined)}>Cancel</button><button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : draft ? "Save subcategory" : "Create subcategory"}</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}


