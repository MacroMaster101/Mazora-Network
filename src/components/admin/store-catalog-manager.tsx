"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ChevronRight, Crown, Edit3, Eye, EyeOff, Gamepad2, Gauge, Grid2X2, ImagePlus, KeyRound, List, PackagePlus, Plus, Save, Search, ShoppingBag, Sparkles, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GameMode, Product, StoreCategoryConfig } from "@/lib/types";
import {
  deleteStoreModeAction,
  deleteStoreProductAction,
  saveStoreModeAction,
  saveStoreProductAction,
  toggleStoreModeAction,
  toggleStoreProductAction,
  type StoreAdminActionResult,
} from "@/lib/actions/store-admin";
import { FormRow, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { usd } from "@/lib/utils";
import { deleteStoreCategoryAction, saveStoreCategoryAction } from "@/lib/actions/store-settings";

type ProductDraft = Product | null;
type ModeDraft = GameMode | null;
type CategoryDraft = StoreCategoryConfig | null;

const ACCENTS = ["violet", "cyan", "green", "gold", "rose", "orange"];
const CATEGORY_OPTIONS = [
  { value: "Ranks", label: "Ranks", description: "Supporter tiers", icon: Crown },
  { value: "Crate Keys", label: "Crate Keys", description: "Reward keys", icon: KeyRound },
  { value: "Battlepass", label: "Battlepass", description: "Season access", icon: Sparkles },
  { value: "Add-ons", label: "Add-ons", description: "Progression boosts", icon: Gauge },
] as const;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ProductArtwork({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const source = imageUrl?.trim();

  return (
    <div className={`store-admin-item-icon ${source && !failed ? "has-artwork" : ""}`}>
      {source && !failed ? (
        // Product artwork can come from local assets or the configured storage bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={`${name} artwork`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <ShoppingBag size={20} />
      )}
    </div>
  );
}

function ToggleButton({
  id,
  enabled,
  action,
}: {
  id?: string;
  enabled: boolean;
  action: (formData: FormData) => Promise<StoreAdminActionResult>;
}) {
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={busy || !id}
      className={`btn btn-sm ${enabled ? "btn-secondary" : "btn-primary"}`}
      onClick={() => start(async () => {
        const data = new FormData();
        data.set("id", id ?? "");
        data.set("enabled", String(!enabled));
        const result = await action(data);
        toast(result.message, result.ok ? "success" : "error");
        if (result.ok) router.refresh();
      })}
    >
      {enabled ? <EyeOff size={14} /> : <Eye size={14} />}
      {busy ? "Saving…" : enabled ? "Hide" : "Enable"}
    </button>
  );
}

function ConfirmDeleteButton({
  action,
  values,
  label,
  subject,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  values: Record<string, string | undefined>;
  label?: string;
  subject: string;
}) {
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const disabled = Object.values(values).some((value) => !value);

  return (
    <button
      type="button"
      disabled={busy || disabled}
      className="btn btn-danger btn-sm"
      onClick={() => {
        if (!window.confirm(`Delete ${subject}? This cannot be undone.`)) return;
        start(async () => {
          const data = new FormData();
          Object.entries(values).forEach(([key, value]) => data.set(key, value ?? ""));
          const result = await action(data);
          toast(result.message, result.ok ? "success" : "error");
          if (result.ok) router.refresh();
        });
      }}
    >
      <Trash2 size={14} /> {busy ? "Deleting…" : label ?? "Delete"}
    </button>
  );
}
export function StoreCatalogManager({
  products,
  modes,
  categoryConfigs,
  view = "modes",
  initialModeSlug,
  initialCategory = "Ranks",
  initialSubcategory,
}: {
  products: Product[];
  modes: GameMode[];
  categoryConfigs: StoreCategoryConfig[];
  view?: "modes" | "categories" | "items";
  initialModeSlug?: string;
  initialCategory?: string;
  initialSubcategory?: string;
}) {
  const selectedModeSlug = initialModeSlug ?? modes.find((mode) => mode.storeStatus === "live")?.slug ?? modes[0]?.slug ?? "";
  const selectedCategory = initialCategory;
  const [productDraft, setProductDraft] = useState<ProductDraft | undefined>();
  const [modeDraft, setModeDraft] = useState<ModeDraft | undefined>();
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | undefined>();
  const [itemQuery, setItemQuery] = useState("");
  const [itemStatus, setItemStatus] = useState<"all" | "live" | "hidden">("all");
  const [itemLayout, setItemLayout] = useState<"rows" | "cards">("rows");
  const [busy, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<string>("Ranks");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [artworkRemoved, setArtworkRemoved] = useState(false);
  const artworkInput = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  function openProduct(product: ProductDraft) {
    setProductDraft(product);
    setName(product?.name ?? "");
    setSlug(product?.slug ?? "");
    setSlugTouched(Boolean(product));
    setCategory(product?.category ?? selectedCategory);
    setArtworkUrl(product?.imageUrl ?? "");
    setArtworkPreview(product?.imageUrl ?? null);
    setArtworkRemoved(false);
    if (artworkInput.current) artworkInput.current.value = "";
  }

  function openMode(mode: ModeDraft) {
    setModeDraft(mode);
    setName(mode?.name ?? "");
    setSlug(mode?.slug ?? "");
    setSlugTouched(Boolean(mode));
  }

  function submit(
    formData: FormData,
    action: (data: FormData) => Promise<StoreAdminActionResult>,
    close: () => void,
  ) {
    start(async () => {
      const result = await action(formData);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        close();
        router.refresh();
      }
    });
  }

  const selectedMode = modes.find((mode) => mode.slug === selectedModeSlug) ?? modes[0];
  const modeCategories = categoryConfigs
    .filter((item) => item.gameModeSlug === selectedMode?.slug)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const modeProducts = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === selectedMode?.slug);
  const categoryProducts = modeProducts.filter((product) => product.category === selectedCategory && (!initialSubcategory || (product.subcategory ?? product.billing) === initialSubcategory));
  const visibleProducts = useMemo(() => categoryProducts.filter((product) => {
    const matchesQuery = `${product.name} ${product.slug} ${product.description}`.toLowerCase().includes(itemQuery.trim().toLowerCase());
    const matchesStatus = itemStatus === "all" || (itemStatus === "live" ? product.enabled !== false : product.enabled === false);
    return matchesQuery && matchesStatus;
  }), [categoryProducts, itemQuery, itemStatus]);
  const selectedCategoryConfig = modeCategories.find((item) => item.key === selectedCategory);
  const productCategoryConfig = modeCategories.find((item) => item.key === category);
  const selectedSubcategory = selectedCategoryConfig?.subcategories.find((item) => item.key === initialSubcategory);

  return (
    <>
      <div className="store-admin-hierarchy mb-7">
        <div className="store-admin-flow-head">
          <div>
            <p className="eyebrow">Store catalog</p>
            <h2>{view === "modes" ? "Choose a marketplace." : view === "categories" ? `${selectedMode?.name} categories.` : `${selectedSubcategory?.label ?? selectedCategoryConfig?.label ?? selectedCategory} dashboard.`}</h2>
            <p>{view === "modes" ? "Open a game mode to manage its categories and products." : view === "categories" ? "Choose a category to open its dedicated item dashboard." : initialSubcategory ? `Manage only the items assigned to ${selectedSubcategory?.label ?? initialSubcategory}.` : `Search, filter, add, edit, and publish ${selectedMode?.name ?? "Store"} items.`}</p>
          </div>
          <div className="store-admin-head-actions">
            {view === "categories" && <button type="button" className="btn btn-primary btn-sm" onClick={() => setCategoryDraft(null)}><Plus size={15} /> New category</button>}
            {view === "modes" && <button type="button" className="btn btn-primary btn-sm" onClick={() => openMode(null)}><Plus size={15} /> New game mode</button>}
            {view === "items" && <button type="button" className="btn btn-primary btn-sm" onClick={() => openProduct(null)}><Plus size={15} /> Add item</button>}
          </div>
        </div>

        <nav className="store-admin-breadcrumbs" aria-label="Store catalog breadcrumb">
          <Link href="/admin/store" className={view === "modes" ? "is-current" : ""}><b>01</b> Game modes</Link>
          <ChevronRight size={14} />
          {selectedMode && view !== "modes" ? <Link href={`/admin/store/${selectedMode.slug}`} className={view === "categories" ? "is-current" : ""}><b>02</b> {selectedMode.name}</Link> : <span><b>02</b> Categories</span>}
          <ChevronRight size={14} />
          <span className={view === "items" ? "is-current" : ""}><b>03</b> {view === "items" ? selectedCategoryConfig?.label ?? selectedCategory : "Items"}</span>
        </nav>

        {view === "modes" && (
          <section className="store-admin-flow-section" aria-labelledby="store-mode-step">
            <div className="store-admin-flow-section-head">
              <div><span>01</span><div><h3 id="store-mode-step">Game mode marketplaces</h3><p>Featured picks stay above; each card opens a separate catalog.</p></div></div>
              <small>{modes.length} modes · {products.length} items</small>
            </div>
            <div className="store-admin-mode-picker">
              {modes.map((mode) => {
                const count = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug).length;
                const liveCount = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug && product.enabled !== false).length;
                return (
                  <article key={mode.id ?? mode.slug} className={`store-admin-mode-choice ${mode.enabled === false ? "is-disabled" : ""}`}>
                    <Link href={`/admin/store/${mode.slug}`} className="store-admin-choice-main">
                      <span><Gamepad2 size={19} /></span>
                      <strong>{mode.name}</strong>
                      <small>{liveCount}/{count} items live</small>
                      <i className={mode.storeStatus === "live" ? "is-live" : ""}>{mode.storeStatus === "live" ? "Live" : "Soon"}</i>
                      <em>Open categories <ChevronRight size={14} /></em>
                    </Link>
                    <div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openMode(mode)}><Edit3 size={14} /> Edit</button>
                      <ToggleButton id={mode.id} enabled={mode.enabled !== false} action={toggleStoreModeAction} />
                      <ConfirmDeleteButton action={deleteStoreModeAction} values={{ id: mode.id }} subject={mode.name} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {view === "categories" && selectedMode && (
          <section className="store-admin-flow-section" aria-labelledby="store-category-step">
            <div className="store-admin-flow-section-head">
              <div><span>02</span><div><h3 id="store-category-step">{selectedMode.name} categories</h3><p>Open a category to manage only the products inside it.</p></div></div>
              <small>{modeProducts.length} total items</small>
            </div>
            <div className="store-admin-category-picker">
              {modeCategories.map((config) => {
                const option = CATEGORY_OPTIONS.find((item) => item.value === config.key);
                const Icon = option?.icon ?? ShoppingBag;
                const count = modeProducts.filter((product) => product.category === config.key).length;
                const liveCount = modeProducts.filter((product) => product.category === config.key && product.enabled !== false).length;
                return (
                  <article key={`${config.gameModeSlug}:${config.key}`} className={`store-admin-category-choice accent-${config.accent} ${!config.enabled ? "is-disabled" : ""}`}>
                    <Link href={`/admin/store/${selectedMode.slug}/${slugify(config.key)}`} className="store-admin-choice-main">
                      <span><Icon size={19} /></span>
                      <small>{config.eyebrow}</small>
                      <strong>{config.label}</strong>
                      <p>{config.description}</p>
                      <b>{liveCount}/{count} live</b>
                      <em>Open item dashboard <ChevronRight size={14} /></em>
                    </Link>
                    <div className="store-admin-category-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCategoryDraft(config)}><Edit3 size={14} /> Edit</button>
                      <ConfirmDeleteButton action={deleteStoreCategoryAction} values={{ gameModeSlug: config.gameModeSlug, key: config.key }} subject={`${selectedMode.name} ${config.label} category`} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {view === "items" && selectedMode && selectedCategoryConfig && (
          <section className="store-admin-flow-section store-admin-items-section" aria-labelledby="store-items-step">
            <div className="store-admin-flow-section-head">
              <div><span>{initialSubcategory ? "04" : "03"}</span><div><h3 id="store-items-step">{selectedSubcategory?.label ?? selectedCategoryConfig.label} items</h3><p>{categoryProducts.length} products assigned to {selectedSubcategory?.label ?? selectedCategoryConfig.label}.</p></div></div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCategoryDraft(selectedCategoryConfig)}><Edit3 size={14} /> Edit category</button>
            </div>
            <div className="store-admin-item-toolbar">
              <label className="store-admin-search"><Search size={16} /><input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Search name, slug, or description" /></label>
              <select value={itemStatus} onChange={(event) => setItemStatus(event.target.value as "all" | "live" | "hidden")} aria-label="Filter items by status">
                <option value="all">All items</option><option value="live">Live only</option><option value="hidden">Hidden only</option>
              </select>
              <div className="store-admin-layout-toggle" aria-label="Item layout">
                <button type="button" className={itemLayout === "rows" ? "is-active" : ""} onClick={() => setItemLayout("rows")} title="Row view"><List size={16} /></button>
                <button type="button" className={itemLayout === "cards" ? "is-active" : ""} onClick={() => setItemLayout("cards")} title="Card view"><Grid2X2 size={16} /></button>
              </div>
              <span>{visibleProducts.length} shown</span>
            </div>
            <div className={`store-admin-product-list ${itemLayout === "cards" ? "is-card-layout" : "is-row-layout"}`}>
              {visibleProducts.map((product) => (
                <article key={product.id ?? product.slug} className={`store-admin-product-row panel ${product.enabled === false ? "is-hidden" : ""}`}>
                  <ProductArtwork key={product.imageUrl || "fallback"} imageUrl={product.imageUrl} name={product.name} />
                  <div className="store-admin-product-copy">
                    <div><h3>{product.name}</h3><span className="cr-tag">{product.enabled === false ? "Hidden" : "Live"}</span></div>
                    <p>{product.description}</p>
                    <small>{product.slug} · order {product.sortOrder ?? 0}</small>
                  </div>
                  <div className="store-admin-product-price">{usd(product.salePrice ?? product.price)}</div>
                  <div className="store-admin-product-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openProduct(product)}><Edit3 size={14} /> Edit</button>
                    <ToggleButton id={product.id} enabled={product.enabled !== false} action={toggleStoreProductAction} />
                    <ConfirmDeleteButton action={deleteStoreProductAction} values={{ id: product.id }} subject={product.name} />
                  </div>
                </article>
              ))}
              {visibleProducts.length === 0 && (
                <div className="store-admin-empty-category panel">
                  <PackagePlus size={28} />
                  <h3>No matching {selectedCategoryConfig.label.toLowerCase()}</h3>
                  <p>Clear the filters or create a new item for {selectedMode.name}.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => openProduct(null)}><Plus size={14} /> Create item</button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>      <Modal open={productDraft !== undefined} onClose={() => setProductDraft(undefined)} label={productDraft ? "Edit Store product" : "Create Store product"}>
        <form action={(data) => submit(data, saveStoreProductAction, () => setProductDraft(undefined))} className="store-admin-modal panel overflow-hidden">
          <div className="store-admin-modal-head border-b border-line px-6 py-5">
            <div>
              <p className="eyebrow">{productDraft ? "Edit catalog item" : "New catalog item"}</p>
              <h2 className="mt-2 text-2xl font-black">{productDraft ? productDraft.name : "Create product"}</h2>
            </div>
            <div className="store-admin-form-steps" aria-label="Product form sections">
              <span>Basics</span><span>Type</span><span>Artwork</span><span>Details</span>
            </div>
          </div>

          <div className="store-admin-form-body grid gap-5 p-6 md:grid-cols-2">
            {productDraft?.id && <input type="hidden" name="id" value={productDraft.id} />}

            <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-product-basics">
              <header>
                <span>01</span>
                <div><h3 id="store-product-basics">Product basics</h3><p>Name it, describe it, and choose where it belongs.</p></div>
              </header>
              <div className="grid gap-5 md:grid-cols-2">
                <FormRow label="Product name" htmlFor="product-name">
                  <Input id="product-name" name="name" value={name} onChange={(event) => {
                    setName(event.target.value);
                    if (!slugTouched) setSlug(slugify(event.target.value));
                  }} required />
                </FormRow>
                <input type="hidden" name="slug" value={slug} />
                <div className="md:col-span-2">
                  <FormRow label="Description" htmlFor="product-description" hint="Shown on cards and details">
                    <Textarea id="product-description" name="description" rows={3} defaultValue={productDraft?.description ?? ""} required />
                  </FormRow>
                </div>
                <FormRow label="Game mode" htmlFor="product-mode">
                  <Select id="product-mode" name="gameModeSlug" defaultValue={productDraft?.gameModeSlug ?? selectedModeSlug ?? "survival-smp"}>
                    {modes.map((mode) => <option key={mode.slug} value={mode.slug}>{mode.name} · {mode.storeStatus === "live" ? "Live" : "Coming soon"}</option>)}
                  </Select>
                </FormRow>
                <FormRow label="Display order" htmlFor="product-order" hint="Lower appears first">
                  <Input id="product-order" name="sortOrder" type="number" defaultValue={productDraft?.sortOrder ?? visibleProducts.length * 10} />
                </FormRow>
              </div>
            </section>

            <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-product-type">
              <header>
                <span>02</span>
                <div><h3 id="store-product-type">Product type</h3><p>Only fields relevant to this selection will appear.</p></div>
              </header>
              <div className="store-admin-category-options">
                {modeCategories.map((config) => {
                  const option = CATEGORY_OPTIONS.find((item) => item.value === config.key);
                  const Icon = option?.icon ?? ShoppingBag;
                  return (
                    <label key={config.key} className={category === config.key ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name="category"
                        value={config.key}
                        checked={category === config.key}
                        onChange={() => setCategory(config.key)}
                      />
                      <span><Icon size={17} /></span>
                      <strong>{config.label}</strong>
                      <small>{option?.description ?? config.eyebrow}</small>
                    </label>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <FormRow label="Price (USD)" htmlFor="product-price">
                  <Input id="product-price" name="price" type="number" min="0" step="0.01" defaultValue={productDraft?.price ?? 0} required />
                </FormRow>
                <FormRow label="Sale price" htmlFor="product-sale" hint="Optional">
                  <Input id="product-sale" name="salePrice" type="number" min="0" step="0.01" defaultValue={productDraft?.salePrice ?? ""} />
                </FormRow>

                {category === "Ranks" && (
                  <>
                    <FormRow label="Rank family" htmlFor="product-family" hint="Hero, VIP, Legend…">
                      <Input id="product-family" name="family" defaultValue={productDraft?.family ?? ""} required />
                    </FormRow>
                    <FormRow label="Billing period" htmlFor="product-billing">
                      <Select id="product-billing" name="billing" defaultValue={productDraft?.billing ?? initialSubcategory ?? "Monthly"} required>
                        <option>Monthly</option><option>Permanent</option>
                      </Select>
                    </FormRow>
                  </>
                )}

                {category !== "Ranks" && productCategoryConfig?.useSubcategories && productCategoryConfig.subcategories.length > 0 && (
                  <div className="md:col-span-2">
                    <FormRow label="Subcategory" htmlFor="product-subcategory" hint={`Choose where this item appears inside ${productCategoryConfig.label}`}>
                      <Select id="product-subcategory" name="subcategory" defaultValue={productDraft?.subcategory ?? initialSubcategory ?? productCategoryConfig.subcategories[0]?.key} required>
                        {productCategoryConfig.subcategories.map((item) => <option key={item.key} value={item.key}>{item.label}{item.enabled ? "" : " · Hidden"}</option>)}
                      </Select>
                    </FormRow>
                  </div>
                )}

                {category === "Crate Keys" && (
                  <div className="store-admin-context-note md:col-span-2"><KeyRound size={16} /><span>Crate key products need no rank or add-on metadata.</span></div>
                )}
                {category === "Battlepass" && (
                  <div className="store-admin-context-note md:col-span-2"><Sparkles size={16} /><span>Battlepass products are grouped automatically under Cosmetics.</span></div>
                )}
              </div>
            </section>

            <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-product-visuals">
              <header>
                <span>03</span>
                <div><h3 id="store-product-visuals">Artwork &amp; identity</h3><p>Upload permanent Store artwork or provide an image link.</p></div>
              </header>
              <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className={`store-admin-artwork-preview ${artworkPreview && !artworkRemoved ? "has-image" : ""}`} style={artworkPreview && !artworkRemoved ? { backgroundImage: `url("${artworkPreview.replaceAll('"', '%22')}")` } : undefined}>
                  {!artworkPreview || artworkRemoved ? <><ImagePlus size={30} /><strong>No artwork selected</strong><small>JPEG, PNG, WebP or GIF · max 8 MB</small></> : <span>Artwork preview</span>}
                </div>
                <div className="grid content-start gap-4">
                  <div className="store-admin-upload-row">
                    <input
                      ref={artworkInput}
                      id="product-image-file"
                      name="imageFile"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setArtworkPreview(typeof reader.result === "string" ? reader.result : null);
                        reader.readAsDataURL(file);
                        setArtworkRemoved(false);
                      }}
                    />
                    <label htmlFor="product-image-file" className="btn btn-primary"><Upload size={15} /> Choose image</label>
                    {(artworkPreview || artworkUrl) && (
                      <button type="button" className="btn btn-secondary" onClick={() => {
                        setArtworkPreview(null);
                        setArtworkUrl("");
                        setArtworkRemoved(true);
                        if (artworkInput.current) artworkInput.current.value = "";
                      }}><X size={15} /> Remove</button>
                    )}
                  </div>
                  <input type="checkbox" name="removeArtwork" checked={artworkRemoved} readOnly hidden />
                  <FormRow label="Or paste an artwork URL" htmlFor="product-art" hint="External links are copied to storage">
                    <Input id="product-art" name="imageUrl" value={artworkUrl} onChange={(event) => {
                      setArtworkUrl(event.target.value);
                      setArtworkPreview(event.target.value || null);
                      setArtworkRemoved(false);
                      if (artworkInput.current) artworkInput.current.value = "";
                    }} placeholder="https://… or /images/store/…" />
                  </FormRow>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Accent" htmlFor="product-accent">
                      <Select id="product-accent" name="accent" defaultValue={productDraft?.accent ?? "violet"}>
                        {ACCENTS.map((item) => <option key={item}>{item}</option>)}
                      </Select>
                    </FormRow>
                    <FormRow label="Badge" htmlFor="product-badge" hint="Optional">
                      <Input id="product-badge" name="badge" defaultValue={productDraft?.badge ?? ""} placeholder="Popular, Seasonal…" />
                    </FormRow>
                  </div>
                </div>
              </div>
            </section>

            <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-product-details">
              <header>
                <span>04</span>
                <div><h3 id="store-product-details">Included details</h3><p>Each line becomes a benefit on the public product page.</p></div>
              </header>
              <FormRow label="Included features" htmlFor="product-features" hint="One per line">
                <Textarea id="product-features" name="features" rows={5} defaultValue={productDraft?.features.join("\n") ?? ""} placeholder="Permanent access&#10;Survival SMP&#10;Staff delivery" />
              </FormRow>
            </section>

            <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={productDraft?.enabled ?? true} className="h-4 w-4 accent-violet-500" />
              <span><strong>Publish this product</strong><small className="mt-0.5 block font-normal text-muted">Enabled products appear immediately in the assigned game mode Store.</small></span>
            </label>
          </div>
          <div className="store-admin-modal-actions flex justify-end gap-2 border-t border-line px-6 py-4">
            <button type="button" className="btn btn-secondary" onClick={() => setProductDraft(undefined)}>Cancel</button>
            <button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : "Save product"}</button>
          </div>
        </form>
      </Modal>
      <Modal open={categoryDraft !== undefined} onClose={() => setCategoryDraft(undefined)} label={categoryDraft ? "Edit Store category" : "Create Store category"}>
        {categoryDraft !== undefined && selectedMode && (
          <form action={(data) => submit(data, saveStoreCategoryAction, () => setCategoryDraft(undefined))} className="store-admin-modal panel overflow-hidden">
            <div className="store-admin-modal-head border-b border-line px-6 py-5">
              <div>
                <p className="eyebrow">{selectedMode.name} marketplace</p>
                <h2 className="mt-2 text-2xl font-black">{categoryDraft ? `Edit ${categoryDraft.label}` : "Create category"}</h2>
                <p className="mt-1 text-sm text-muted">{categoryDraft ? "Update this category's public presentation and visibility." : "Create a custom category for this game mode and assign products to it."}</p>
              </div>
            </div>
            <div className="grid gap-5 p-6 md:grid-cols-2">
              <input type="hidden" name="gameModeSlug" value={selectedMode.slug} />
              {categoryDraft ? <input type="hidden" name="key" value={categoryDraft.key} /> : (
                <FormRow label="Category key" htmlFor="category-key" hint="Stable internal name">
                  <Input id="category-key" name="key" placeholder="Pets, Bundles, Cosmetics…" required />
                </FormRow>
              )}
              <FormRow label="Display name" htmlFor="category-label">
                <Input id="category-label" name="label" defaultValue={categoryDraft?.label ?? ""} required />
              </FormRow>
              <FormRow label="Category label" htmlFor="category-eyebrow" hint="Short uppercase label">
                <Input id="category-eyebrow" name="eyebrow" defaultValue={categoryDraft?.eyebrow ?? "Collection"} required />
              </FormRow>
              <div className="md:col-span-2">
                <FormRow label="Description" htmlFor="category-description">
                  <Textarea id="category-description" name="description" rows={4} defaultValue={categoryDraft?.description ?? "Store products for this game mode."} required />
                </FormRow>
              </div>
              <FormRow label="Accent" htmlFor="category-accent">
                <Select id="category-accent" name="accent" defaultValue={categoryDraft?.accent ?? "violet"}>
                  {ACCENTS.map((item) => <option key={item}>{item}</option>)}
                </Select>
              </FormRow>
              <FormRow label="Display order" htmlFor="category-order" hint="Lower appears first">
                <Input id="category-order" name="sortOrder" type="number" defaultValue={categoryDraft?.sortOrder ?? modeCategories.length * 10} />
              </FormRow>
              <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold md:col-span-2">
                <input type="checkbox" name="useSubcategories" defaultChecked={categoryDraft?.useSubcategories ?? false} className="h-4 w-4 accent-violet-500" />
                <span><strong>Use subcategories</strong><small className="mt-0.5 block font-normal text-muted">This category opens subcategory cards before its item dashboard.</small></span>
              </label>
              <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold md:col-span-2">
                <input type="checkbox" name="enabled" defaultChecked={categoryDraft?.enabled ?? true} className="h-4 w-4 accent-violet-500" />
                <span><strong>Show this category</strong><small className="mt-0.5 block font-normal text-muted">Enabled categories appear in the public Store.</small></span>
              </label>
            </div>
            <div className="store-admin-modal-actions flex justify-end gap-2 border-t border-line px-6 py-4">
              <button type="button" className="btn btn-secondary" onClick={() => setCategoryDraft(undefined)}>Cancel</button>
              <button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : categoryDraft ? "Save category" : "Create category"}</button>
            </div>
          </form>
        )}
      </Modal>      <Modal open={modeDraft !== undefined} onClose={() => setModeDraft(undefined)} label={modeDraft ? "Edit Store game mode" : "Create Store game mode"}>
        <form action={(data) => submit(data, saveStoreModeAction, () => setModeDraft(undefined))} className="store-admin-modal panel overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <p className="eyebrow">{modeDraft ? "Edit marketplace" : "New marketplace"}</p>
            <h2 className="mt-2 text-2xl font-black">{modeDraft ? modeDraft.name : "Create game mode"}</h2>
          </div>
          <div className="grid gap-5 p-6 md:grid-cols-2">
            {modeDraft?.id && <input type="hidden" name="id" value={modeDraft.id} />}
            <FormRow label="Mode name" htmlFor="mode-name">
              <Input id="mode-name" name="name" value={name} onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }} required />
            </FormRow>
            <FormRow label="Slug" htmlFor="mode-slug">
              <Input id="mode-slug" name="slug" value={slug} onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }} required />
            </FormRow>
            <div className="md:col-span-2">
              <FormRow label="Description" htmlFor="mode-description">
                <Textarea id="mode-description" name="description" rows={3} defaultValue={modeDraft?.description ?? ""} />
              </FormRow>
            </div>
            <FormRow label="Tab label" htmlFor="mode-tagline">
              <Input id="mode-tagline" name="tagline" defaultValue={modeDraft?.tagline ?? ""} placeholder="Store live" />
            </FormRow>
            <FormRow label="Minecraft version" htmlFor="mode-version">
              <Input id="mode-version" name="version" defaultValue={modeDraft?.version ?? "1.21.11"} required />
            </FormRow>
            <FormRow label="Store status" htmlFor="mode-status">
              <Select id="mode-status" name="storeStatus" defaultValue={modeDraft?.storeStatus ?? "coming_soon"}>
                <option value="live">Store live</option><option value="coming_soon">Coming soon</option>
              </Select>
            </FormRow>
            <FormRow label="Accent" htmlFor="mode-accent">
              <Select id="mode-accent" name="accent" defaultValue={modeDraft?.accent ?? "violet"}>
                {ACCENTS.map((item) => <option key={item}>{item}</option>)}
              </Select>
            </FormRow>
            <FormRow label="Icon key" htmlFor="mode-icon">
              <Input id="mode-icon" name="icon" defaultValue={modeDraft?.icon ?? "gamepad-2"} />
            </FormRow>
            <FormRow label="Display order" htmlFor="mode-order">
              <Input id="mode-order" name="sortOrder" type="number" defaultValue={modeDraft?.sortOrder ?? modes.length * 10} />
            </FormRow>
            <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={modeDraft?.enabled ?? true} className="h-4 w-4 accent-violet-500" />
              Show this game mode in the Store selector
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <button type="button" className="btn btn-secondary" onClick={() => setModeDraft(undefined)}>Cancel</button>
            <button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : "Save game mode"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}













