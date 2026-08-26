"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Award, CalendarDays, Check, ChevronRight, CircleOff, Clock3, Crown, Edit3, ExternalLink, Eye, EyeOff, Flame, Gauge, Gem, Grid2X2, GripVertical, ImagePlus, KeyRound, Layers3, List, PackagePlus, Plus, RotateCcw, Save, ScanEye, Search, ShieldCheck, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GameMode, Product, StoreCategoryConfig } from "@/lib/types";
import {
  deleteStoreModeAction,
  deleteStoreProductAction,
  reorderStoreModesAction,
  reorderStoreProductAction,
  saveStoreProductAction,
  toggleStoreModeAction,
  toggleStoreProductAction,
  type StoreAdminActionResult,
} from "@/lib/actions/store-admin";
import { FormRow, Input, Modal, Select, Textarea, TonePill, useToast } from "@/components/ui";
import { usd } from "@/lib/utils";
import { deleteStoreCategoryAction, saveStoreCategoryAction, reorderStoreCategoriesAction, toggleStoreCategoryAction, toggleStoreCategorySubcategoriesAction } from "@/lib/actions/store-settings";
import { Icon } from "@/components/shared/icon";
import { StoreArtwork } from "@/components/shared/store-artwork";
import { GameModeFormModal, MODE_ICON_OPTIONS } from "./game-mode-form-modal";

type ProductDraft = Product | null;
type ModeDraft = GameMode | null;
type CategoryDraft = StoreCategoryConfig | null;

const PRODUCT_BADGE_OPTIONS = [
  { value: "", label: "None", icon: CircleOff },
  { value: "Monthly", label: "Monthly", icon: Clock3 },
  { value: "Permanent", label: "Permanent", icon: Award },
  { value: "Premium", label: "Premium", icon: Sparkles },
  { value: "Popular", label: "Popular", icon: Flame },
  { value: "Best value", label: "Best value", icon: Star },
  { value: "Top rank", label: "Top rank", icon: Crown },
  { value: "Seasonal", label: "Seasonal", icon: CalendarDays },
  { value: "Legendary", label: "Legendary", icon: Gem },
  { value: "Largest boost", label: "Largest boost", icon: Gauge },
  { value: "Largest pack", label: "Largest pack", icon: Layers3 },
] as const;
const MINECRAFT_LABEL_PRESETS = [
  { label: "Ranks", eyebrow: "Progression", icon: "Crown" },
  { label: "Crate Keys", eyebrow: "Rewards", icon: "Gem" },
  { label: "Battlepass", eyebrow: "Seasonal", icon: "Sparkles" },
  { label: "Add-ons", eyebrow: "Utility", icon: "Layers" },
  { label: "Cosmetics", eyebrow: "Cosmetics", icon: "Sparkles" },
  { label: "Pets & Bundles", eyebrow: "Collection", icon: "Gamepad2" },
  { label: "Claim Blocks", eyebrow: "Utility", icon: "Blocks" },
  { label: "Perks & Upgrades", eyebrow: "Perks", icon: "Trophy" },
] as const;

const MINECRAFT_EYEBROW_PRESETS = [
  "Progression",
  "Rewards",
  "Seasonal",
  "Utility",
  "Collection",
  "Cosmetics",
  "Perks",
  "Boosters",
  "Economy",
] as const;

const PRODUCT_ERROR_TARGETS: Record<string, string> = {
  name: "product-name",
  price: "product-price",
  description: "product-description",
  salePrice: "product-sale",
  billing: "product-billing",
  subcategory: "product-subcategory",
  imageFile: "product-image-file",
  imageUrl: "product-art",
  features: "product-features",
};

import { storeArtFor } from "@/lib/store-art";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ProductArtwork({ product, onPreview }: { product: Product; onPreview: () => void }) {
  const [failed, setFailed] = useState(false);
  const source = !failed
    ? storeArtFor(product)
    : storeArtFor(product.category);

  return (
    <button type="button" className="store-admin-item-icon has-artwork" onClick={onPreview} aria-label={`Preview ${product.name} public details`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={source}
        alt={`${product.name} artwork`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <span className="store-admin-artwork-preview-cue"><ScanEye size={13} /> Preview</span>
    </button>
  );
}

function ProductPublicPreview({ product, categoryIcon }: { product: Product; categoryIcon: string }) {
  const currentPrice = product.salePrice ?? product.price;
  const onSale = product.salePrice != null;
  const productContext = product.subcategory ?? product.billing ?? product.category;
  const mediaLabel = product.badge?.localeCompare(productContext, undefined, { sensitivity: "accent" }) === 0
    ? product.category
    : productContext;

  return (
    <div className="store-admin-public-preview" data-accent={product.accent}>
      <header className="store-admin-preview-head">
        <div>
          <p className="eyebrow">Public product preview</p>
          <h2>Customer detail view</h2>
          <p>This is how the product information and artwork are presented before ordering.</p>
        </div>
        <Link href={`/store/${product.slug}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          <ExternalLink size={14} /> Open public page
        </Link>
      </header>

      <div className="store-admin-preview-layout">
        <div className="store-admin-preview-media">
          <StoreArtwork
            src={storeArtFor(product)}
            alt={`${product.name} product artwork`}
            sizes="(max-width: 720px) 90vw, 45vw"
          />
          {product.badge && (
            <span className="store-admin-preview-media-tags">
              <TonePill tone={product.accent}>{product.badge}</TonePill>
            </span>
          )}
          <span className="store-admin-preview-caption">
            <small>{mediaLabel}</small>
            <strong>{product.name}</strong>
          </span>
        </div>

        <div className="store-admin-preview-copy">
          <p className="store-admin-preview-category"><Icon name={categoryIcon} size={14} /> {product.category}</p>
          <h3>{product.name}</h3>
          <p className="store-admin-preview-description">{product.description}</p>

          <div className="store-admin-preview-price">
            <span>Price</span>
            <div><strong>{usd(currentPrice)}</strong><small>USD</small>{onSale && <del>{usd(product.price)}</del>}</div>
          </div>

          <section className="store-admin-preview-features" aria-label="Included product details">
            <h4>What&apos;s included</h4>
            {product.features.length > 0 ? (
              <ul>
                {product.features.map((feature) => <li key={feature}><span><Check size={12} /></span>{feature}</li>)}
              </ul>
            ) : (
              <p>No included details have been added yet.</p>
            )}
          </section>

          <div className="store-admin-preview-order"><ShoppingCartPreviewIcon /> Preview only — ordering is disabled in Admin</div>

          <div className="store-admin-preview-assurances">
            <div><ShieldCheck size={17} /><span><strong>Staff verified</strong><small>Manual secure request</small></span></div>
            <div><Clock3 size={17} /><span><strong>Quick delivery</strong><small>After confirmation</small></span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShoppingCartPreviewIcon() {
  return <ScanEye size={17} aria-hidden="true" />;
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
      className={`btn btn-sm ${enabled ? "btn-secondary" : "btn-primary font-black shadow-md"}`}
      onClick={() => start(async () => {
        const data = new FormData();
        data.set("id", id ?? "");
        data.set("enabled", String(!enabled));
        const result = await action(data);
        toast(result.message, result.ok ? "success" : "error");
        if (result.ok) router.refresh();
      })}
    >
      {enabled ? <EyeOff size={13} /> : <Eye size={13} />}
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
      <Trash2 size={13} /> {busy ? "Deleting…" : label ?? "Delete"}
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
  const [previewProduct, setPreviewProduct] = useState<Product | undefined>();
  const [modeDraft, setModeDraft] = useState<ModeDraft | undefined>();
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | undefined>();
  const [categoryIcon, setCategoryIcon] = useState("Gem");
  const [categoryLabelValue, setCategoryLabelValue] = useState("");
  const [categoryEyebrowValue, setCategoryEyebrowValue] = useState("Collection");
  const [itemQuery, setItemQuery] = useState("");
  const [itemStatus, setItemStatus] = useState<"all" | "live" | "hidden">("all");
  const [itemLayout, setItemLayout] = useState<"rows" | "cards">("rows");
  const [busy, start] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Ranks");
  const [productBadge, setProductBadge] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [originalArtworkUrl, setOriginalArtworkUrl] = useState("");
  const [artworkChanged, setArtworkChanged] = useState(false);
  const [artworkRemoved, setArtworkRemoved] = useState(false);
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const artworkInput = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [modeLayout, setModeLayout] = useState<"cards" | "rows">("cards");
  const [categoryLayout, setCategoryLayout] = useState<"cards" | "rows">("cards");

  function openProduct(product: ProductDraft) {
    setProductErrors({});
    setProductDraft(product);
    setName(product?.name ?? "");
    setCategory(product?.category ?? selectedCategory);
    setProductBadge(product?.badge ?? "");
    const art = product ? storeArtFor(product) : null;
    setArtworkUrl(art || "");
    setArtworkPreview(art);
    setOriginalArtworkUrl(art || "");
    setArtworkChanged(false);
    setArtworkRemoved(false);
    if (artworkInput.current) artworkInput.current.value = "";
  }

  function restoreArtwork() {
    setArtworkUrl(originalArtworkUrl);
    setArtworkPreview(originalArtworkUrl || null);
    setArtworkRemoved(false);
    setArtworkChanged(false);
    if (artworkInput.current) artworkInput.current.value = "";
  }

  function openMode(mode: ModeDraft) {
    setModeDraft(mode);
  }

  function openCategory(draft: CategoryDraft) {
    setCategoryDraft(draft);
    setCategoryIcon(draft?.icon ?? "Gem");
    setCategoryLabelValue(draft?.label ?? "");
    setCategoryEyebrowValue(draft?.eyebrow ?? "Collection");
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

  function submitProduct(formData: FormData) {
    start(async () => {
      const result = await saveStoreProductAction(formData);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setProductErrors({});
        setProductDraft(undefined);
        router.refresh();
        return;
      }

      const nextErrors = result.errors ?? {};
      setProductErrors(nextErrors);
      const firstTarget = Object.keys(nextErrors).map((key) => PRODUCT_ERROR_TARGETS[key]).find(Boolean);
      if (firstTarget) {
        requestAnimationFrame(() => {
          const field = document.getElementById(firstTarget);
          field?.scrollIntoView({ behavior: "smooth", block: "center" });
          field?.focus({ preventScroll: true });
        });
      }
    });
  }

  const selectedMode = modes.find((mode) => mode.slug === selectedModeSlug) ?? modes[0];
  const orderedModes = [...modes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const modeCategories = categoryConfigs
    .filter((item) => item.gameModeSlug === selectedMode?.slug)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const modeProducts = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === selectedMode?.slug);
  const categoryProducts = modeProducts.filter((product) => product.category === selectedCategory && (!initialSubcategory || (product.subcategory ?? product.billing) === initialSubcategory));
  const visibleProducts = useMemo(() => categoryProducts.filter((product) => {
    const matchesQuery = `${product.name} ${product.description}`.toLowerCase().includes(itemQuery.trim().toLowerCase());
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
            {view === "categories" && <button type="button" className="btn btn-primary btn-sm" onClick={() => openCategory(null)}><Plus size={15} /> New category</button>}
            {view === "modes" && <button type="button" className="btn btn-primary btn-sm" onClick={() => openMode(null)}><Plus size={15} /> New game mode</button>}
            {view === "items" && <button type="button" className="btn btn-primary btn-sm" onClick={() => openProduct(null)}><Plus size={15} /> Add item</button>}
          </div>
        </div>

        <nav className="store-admin-breadcrumbs" aria-label="Store catalog breadcrumb">
          <Link href="/admin/store/catalog" className={view === "modes" ? "is-current" : ""}><b>01</b> Game modes</Link>
          <ChevronRight size={14} />
          {selectedMode && view !== "modes" ? <Link href={`/admin/store/catalog/${selectedMode.slug}`} className={view === "categories" ? "is-current" : ""}><b>02</b> {selectedMode.name}</Link> : <span><b>02</b> Categories</span>}
          <ChevronRight size={14} />
          {view === "items" && initialSubcategory && selectedMode ? (
            <>
              <Link href={`/admin/store/catalog/${selectedMode.slug}/${slugify(selectedCategoryConfig?.key ?? selectedCategory)}`}><b>03</b> {selectedCategoryConfig?.label ?? selectedCategory}</Link>
              <ChevronRight size={14} />
              <span className="is-current"><b>04</b> {selectedSubcategory?.label ?? initialSubcategory}</span>
            </>
          ) : (
            <span className={view === "items" ? "is-current" : ""}><b>03</b> {view === "items" ? selectedCategoryConfig?.label ?? selectedCategory : "Items"}</span>
          )}
        </nav>

        {view === "modes" && (
          <section className="store-admin-flow-section" aria-labelledby="store-mode-step">
            <div className="store-admin-flow-section-head">
              <div><span>01</span><div><h3 id="store-mode-step">Game mode marketplaces</h3><p>Featured picks stay above; each card opens a separate catalog.</p></div></div>
              <div className="flex items-center gap-3">
                <div className="store-admin-layout-toggle" aria-label="Game Mode layout">
                  <button type="button" className={modeLayout === "rows" ? "is-active" : ""} onClick={() => setModeLayout("rows")} title="Row view"><List size={16} /></button>
                  <button type="button" className={modeLayout === "cards" ? "is-active" : ""} onClick={() => setModeLayout("cards")} title="Card view"><Grid2X2 size={16} /></button>
                </div>
                <span className="store-admin-flow-count">{orderedModes.length} modes</span>
              </div>
            </div>
            <div className={`store-admin-mode-picker ${modeLayout === "cards" ? "is-card-layout" : "is-row-layout"}`}>
              {orderedModes.map((mode, index) => {
                const count = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug).length;
                const liveCount = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug && product.enabled !== false).length;
                const isDragOver = dragOverIndex === index;
                return (
                  <article
                    key={mode.id ?? mode.slug}
                    draggable={Boolean(mode.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", String(index));
                      setDraggedIndex(index);
                    }}
                    onDragOver={(event) => {
                      if (!mode.id) return;
                      event.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceIndex = Number(event.dataTransfer.getData("text/plain"));
                      const sourceMode = orderedModes[sourceIndex];
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                      if (!sourceMode?.id || sourceIndex === index || Number.isNaN(sourceIndex)) return;
                      start(async () => {
                        const data = new FormData();
                        data.set("id", sourceMode.id ?? "");
                        data.set("direction", "drag");
                        data.set("targetIndex", String(index));
                        const result = await reorderStoreModesAction(data);
                        toast(result.message, result.ok ? "success" : "error");
                        if (result.ok) router.refresh();
                      });
                    }}
                    className={`store-admin-mode-choice transition-all ${mode.enabled === false ? "is-disabled" : ""} ${isDragOver ? "border-2 border-violet-500 bg-violet-500/10 scale-[1.01] shadow-lg" : ""}`}
                  >
                    <div className="store-admin-choice-header flex flex-wrap items-center justify-between gap-2 p-3 pb-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="cursor-grab p-0.5 text-muted hover:text-foreground active:cursor-grabbing" title="Drag to reorder game mode"><GripVertical size={16} /></span>
                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-surface-hover border border-line text-foreground">#{index + 1}</span>
                        <span className="max-w-24 truncate text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-surface-hover border border-line text-foreground">{mode.slug}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {mode.enabled === false ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-sm"><EyeOff size={11} /> HIDDEN</span>
                        ) : mode.storeStatus === "live" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" /> LIVE</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-sm">SOON</span>
                        )}
                        <div className="flex items-center rounded-lg border border-line bg-surface-hover/80 p-0.5 shadow-sm">
                          <button
                            type="button"
                            disabled={!mode.id || index === 0 || busy}
                            className="rounded p-1 text-foreground transition-colors hover:bg-surface disabled:opacity-20"
                            onClick={() => start(async () => {
                              const data = new FormData();
                              data.set("id", mode.id ?? "");
                              data.set("direction", "up");
                              const result = await reorderStoreModesAction(data);
                              toast(result.message, result.ok ? "success" : "error");
                              if (result.ok) router.refresh();
                            })}
                            title={modeLayout === "rows" ? "Move game mode up" : "Move game mode left"}
                          >{modeLayout === "rows" ? <ArrowUp size={13} /> : <ArrowLeft size={13} />}</button>
                          <span className="mx-0.5 h-3 w-px bg-line" />
                          <button
                            type="button"
                            disabled={!mode.id || index === orderedModes.length - 1 || busy}
                            className="rounded p-1 text-foreground transition-colors hover:bg-surface disabled:opacity-20"
                            onClick={() => start(async () => {
                              const data = new FormData();
                              data.set("id", mode.id ?? "");
                              data.set("direction", "down");
                              const result = await reorderStoreModesAction(data);
                              toast(result.message, result.ok ? "success" : "error");
                              if (result.ok) router.refresh();
                            })}
                            title={modeLayout === "rows" ? "Move game mode down" : "Move game mode right"}
                          >{modeLayout === "rows" ? <ArrowDown size={13} /> : <ArrowRight size={13} />}</button>
                        </div>
                      </div>
                    </div>
                    <Link href={`/admin/store/catalog/${mode.slug}`} className="store-admin-choice-main">
                      <span><Icon name={mode.icon} size={22} /></span>
                      <strong>{mode.name}</strong>
                      <small>{liveCount}/{count} items live</small>
                      <em>Open categories <ChevronRight size={14} /></em>
                    </Link>
                    <div className="flex items-center gap-1.5 p-3 pt-0">
                      <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => openMode(mode)}><Edit3 size={13} /> Edit</button>
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
              <div className="flex items-center gap-3">
                <div className="store-admin-layout-toggle" aria-label="Category layout">
                  <button type="button" className={categoryLayout === "rows" ? "is-active" : ""} onClick={() => setCategoryLayout("rows")} title="Row view"><List size={16} /></button>
                  <button type="button" className={categoryLayout === "cards" ? "is-active" : ""} onClick={() => setCategoryLayout("cards")} title="Card view"><Grid2X2 size={16} /></button>
                </div>
                <span className="store-admin-flow-count">{modeCategories.length} categories</span>
              </div>
            </div>
            <div className={`store-admin-category-picker ${categoryLayout === "cards" ? "is-card-layout" : "is-row-layout"}`}>
              {modeCategories.map((config, index) => {
                const count = modeProducts.filter((product) => product.category === config.key).length;
                const liveCount = modeProducts.filter((product) => product.category === config.key && product.enabled !== false).length;
                const isLive = config.enabled !== false;
                const isDragOver = dragOverIndex === index;

                return (
                  <article
                    key={`${config.gameModeSlug}:${config.key}`}
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
                        start(async () => {
                          const data = new FormData();
                          data.set("gameModeSlug", config.gameModeSlug);
                          data.set("key", config.key);
                          data.set("direction", "drag");
                          data.set("targetIndex", String(index));
                          const result = await reorderStoreCategoriesAction(data);
                          toast(result.message, result.ok ? "success" : "error");
                          if (result.ok) router.refresh();
                        });
                      }
                    }}
                    className={`store-admin-category-choice accent-${config.accent} transition-all ${!isLive ? "is-disabled" : ""} ${
                      isDragOver ? "border-2 border-violet-500 bg-violet-500/10 scale-[1.01] shadow-lg" : ""
                    }`}
                  >
                    <div className="store-admin-choice-header flex items-center justify-between p-3 pb-0">
                      <div className="flex items-center gap-1.5">
                        {/* Drag Grip Handle for PC / Laptop Drag and Drop */}
                        <span
                          className="cursor-grab active:cursor-grabbing text-muted hover:text-foreground p-0.5"
                          title="Drag to reorder category"
                        >
                          <GripVertical size={16} />
                        </span>

                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-surface-hover border border-line text-foreground">
                          #{index + 1}
                        </span>
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" /> LIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-sm">
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
                          onClick={() => start(async () => {
                            const data = new FormData();
                            data.set("gameModeSlug", config.gameModeSlug);
                            data.set("key", config.key);
                            data.set("direction", "up");
                            const result = await reorderStoreCategoriesAction(data);
                            toast(result.message, result.ok ? "success" : "error");
                            if (result.ok) router.refresh();
                          })}
                          title="Move category left"
                        >
                          <ArrowLeft size={13} />
                        </button>
                        <span className="w-px h-3 bg-line mx-0.5" />
                        <button
                          type="button"
                          disabled={index === modeCategories.length - 1 || busy}
                          className="p-1 rounded hover:bg-surface text-foreground disabled:opacity-20 transition-colors"
                          onClick={() => start(async () => {
                            const data = new FormData();
                            data.set("gameModeSlug", config.gameModeSlug);
                            data.set("key", config.key);
                            data.set("direction", "down");
                            const result = await reorderStoreCategoriesAction(data);
                            toast(result.message, result.ok ? "success" : "error");
                            if (result.ok) router.refresh();
                          })}
                          title="Move category right"
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>

                    <Link href={`/admin/store/catalog/${selectedMode.slug}/${slugify(config.key)}`} className="store-admin-choice-main">
                      <span><Icon name={config.icon ?? "Gem"} size={19} /></span>
                      <small>{config.eyebrow}</small>
                      <strong>{config.label}</strong>
                      <p>{config.description}</p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <b>{liveCount}/{count} live items</b>

                        {/* Direct 1-Click Subcategories Toggle Button with perfect contrast */}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            start(async () => {
                              const data = new FormData();
                              data.set("gameModeSlug", config.gameModeSlug);
                              data.set("key", config.key);
                              data.set("useSubcategories", String(!config.useSubcategories));
                              const result = await toggleStoreCategorySubcategoriesAction(data);
                              toast(result.message, result.ok ? "success" : "error");
                              if (result.ok) router.refresh();
                            });
                          }}
                          className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-md border transition-all ${
                            config.useSubcategories
                              ? "bg-violet-600 text-white dark:bg-violet-500/30 dark:text-violet-200 border-violet-600 dark:border-violet-500/50 shadow-sm hover:bg-violet-700 dark:hover:bg-violet-500/40"
                              : "bg-surface-hover/80 border-line text-muted hover:text-foreground hover:border-line-hover"
                          }`}
                          title={config.useSubcategories ? "Subcategories enabled. Click to disable." : "Subcategories disabled. Click to enable."}
                        >
                          <Layers3 size={11} />
                          {config.useSubcategories ? "Subcategories ON" : "Subcategories OFF"}
                        </button>
                      </div>
                      <em>Open item dashboard <ChevronRight size={14} /></em>
                    </Link>

                    {/* Bottom Actions: Edit, Hide/Enable Toggle, Delete */}
                    <div className="store-admin-category-actions flex items-center gap-1.5 p-3 pt-0">
                      <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => openCategory(config)}><Edit3 size={13} /> Edit</button>
                      <button
                        type="button"
                        disabled={busy}
                        className={`btn btn-sm ${isLive ? "btn-secondary" : "btn-primary font-black shadow-md"}`}
                        onClick={() => start(async () => {
                          const data = new FormData();
                          data.set("gameModeSlug", config.gameModeSlug);
                          data.set("key", config.key);
                          data.set("enabled", String(!isLive));
                          const result = await toggleStoreCategoryAction(data);
                          toast(result.message, result.ok ? "success" : "error");
                          if (result.ok) router.refresh();
                        })}
                        title={isLive ? "Hide category from public store" : "Publish category to public store"}
                      >
                        {isLive ? <EyeOff size={13} /> : <Eye size={13} />}
                        {isLive ? "Hide" : "Enable"}
                      </button>
                      <ConfirmDeleteButton action={deleteStoreCategoryAction} values={{ gameModeSlug: config.gameModeSlug, key: config.key }} subject={`${selectedMode.name} ${config.label} category`} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {view === "items" && selectedMode && selectedCategoryConfig && (
          <section className="store-admin-flow-section" aria-labelledby="store-items-step">
            <div className="store-admin-flow-section-head">
              <div>
                <span>{initialSubcategory ? "04" : "03"}</span>
                <div>
                  <h3 id="store-items-step">{initialSubcategory ? `${initialSubcategory} items` : `${selectedCategoryConfig.label} items`}</h3>
                  <p>Create, update, reorder, or publish products inside {selectedMode.name}.</p>
                </div>
              </div>
            </div>
            <div className="store-admin-item-toolbar">
              <label className="store-admin-search"><Search size={16} /><input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Search name or description" /></label>
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
              {visibleProducts.map((product, index) => {
                const isRowLayout = itemLayout === "rows";
                const isDragOver = dragOverIndex === index;

                return (
                  <article
                    key={product.id ?? product.slug}
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
                        start(async () => {
                          const data = new FormData();
                          data.set("id", String(product.id ?? ""));
                          data.set("direction", "drag");
                          data.set("targetIndex", String(index));
                          const result = await reorderStoreProductAction(data);
                          toast(result.message, result.ok ? "success" : "error");
                          if (result.ok) router.refresh();
                        });
                      }
                    }}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button, a, input, select, textarea, label")) return;
                      setPreviewProduct(product);
                    }}
                    className={`store-admin-product-row panel transition-all ${product.enabled === false ? "is-hidden" : ""} ${
                      isDragOver ? "border-2 border-violet-500 bg-violet-500/10 scale-[1.01] shadow-lg" : ""
                    }`}
                    title={`Preview ${product.name}`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Drag Grip Handle for PC / Laptop Drag and Drop */}
                      <span
                        className="cursor-grab active:cursor-grabbing text-muted hover:text-foreground p-0.5"
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </span>

                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-surface-hover border border-line text-foreground">
                        #{index + 1}
                      </span>

                      {/* Dynamic Up/Down (Row layout) vs Left/Right (Card layout) Reorder Controls */}
                      <div className="flex items-center rounded-lg border border-line bg-surface-hover/80 p-0.5 shadow-sm">
                        <button
                          type="button"
                          disabled={index === 0 || busy}
                          className="p-1 rounded hover:bg-surface text-foreground disabled:opacity-20 transition-colors"
                          onClick={() => {
                            start(async () => {
                              const data = new FormData();
                              data.set("id", String(product.id ?? ""));
                              data.set("direction", "up");
                              const result = await reorderStoreProductAction(data);
                              toast(result.message, result.ok ? "success" : "error");
                              if (result.ok) router.refresh();
                            });
                          }}
                          title={isRowLayout ? "Move product up" : "Move product left"}
                        >
                          {isRowLayout ? <ArrowUp size={13} /> : <ArrowLeft size={13} />}
                        </button>
                        <span className="w-px h-3 bg-line mx-0.5" />
                        <button
                          type="button"
                          disabled={index === visibleProducts.length - 1 || busy}
                          className="p-1 rounded hover:bg-surface text-foreground disabled:opacity-20 transition-colors"
                          onClick={() => {
                            start(async () => {
                              const data = new FormData();
                              data.set("id", String(product.id ?? ""));
                              data.set("direction", "down");
                              const result = await reorderStoreProductAction(data);
                              toast(result.message, result.ok ? "success" : "error");
                              if (result.ok) router.refresh();
                            });
                          }}
                          title={isRowLayout ? "Move product down" : "Move product right"}
                        >
                          {isRowLayout ? <ArrowDown size={13} /> : <ArrowRight size={13} />}
                        </button>
                      </div>
                    </div>

                    <ProductArtwork key={product.id || product.slug} product={product} onPreview={() => setPreviewProduct(product)} />
                    <div className="store-admin-product-copy">
                      <div><h3>{product.name}</h3><span className="cr-tag">{product.enabled === false ? "Hidden" : "Live"}</span></div>
                      <p>{product.description}</p>
                    </div>
                    <div className="store-admin-product-price">{usd(product.salePrice ?? product.price)}</div>
                    <div className="store-admin-product-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openProduct(product)}><Edit3 size={14} /> Edit</button>
                      <ToggleButton id={product.id} enabled={product.enabled !== false} action={toggleStoreProductAction} />
                      <ConfirmDeleteButton action={deleteStoreProductAction} values={{ id: product.id }} subject={product.name} />
                    </div>
                  </article>
                );
              })}
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
      </div>
      <Modal open={previewProduct !== undefined} onClose={() => setPreviewProduct(undefined)} label={previewProduct ? `${previewProduct.name} public product preview` : "Public product preview"} size="wide">
        {previewProduct && (
          <ProductPublicPreview
            product={previewProduct}
            categoryIcon={(() => {
              const categoryConfig = modeCategories.find((item) => item.key === previewProduct.category);
              const subcategoryKey = previewProduct.subcategory ?? previewProduct.billing;
              return categoryConfig?.subcategories.find((item) => item.key === subcategoryKey)?.icon ?? categoryConfig?.icon ?? "Gem";
            })()}
          />
        )}
      </Modal>
      <Modal open={productDraft !== undefined} onClose={() => setProductDraft(undefined)} label={productDraft ? "Edit Store product" : "Create Store product"} size="editor">
        <form key={productDraft?.id ?? "new-product"} action={submitProduct} className="store-admin-modal panel overflow-hidden" noValidate>
          <div className="store-admin-modal-head border-b border-line px-6 py-5">
            <div>
              <p className="eyebrow">{productDraft ? "Edit catalog item" : "New catalog item"}</p>
              <h2 className="mt-2 text-2xl font-black">{productDraft ? productDraft.name : "Create product"}</h2>
            </div>
            <div className="store-admin-form-steps" aria-label="Product form sections">
              <span>Basics</span><span>Artwork</span><span>Details</span>
            </div>
          </div>

          <div className="store-admin-form-body grid gap-5 p-6 md:grid-cols-2">
            {Object.keys(productErrors).length > 0 && (
              <div className="md:col-span-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300" role="alert" aria-live="polite">
                <strong className="block font-extrabold">Fix the highlighted product fields</strong>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {Object.entries(productErrors).map(([key, message]) => (
                    <li key={key}>
                      {PRODUCT_ERROR_TARGETS[key] ? <a className="font-semibold underline underline-offset-2" href={`#${PRODUCT_ERROR_TARGETS[key]}`}>{message}</a> : message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {productDraft?.id && <input type="hidden" name="id" value={productDraft.id} />}
            <input type="hidden" name="gameModeSlug" value={productDraft?.gameModeSlug ?? selectedModeSlug ?? "survival-smp"} />
            <input type="hidden" name="sortOrder" value={productDraft?.sortOrder ?? visibleProducts.length * 10} />
            <input type="hidden" name="category" value={productDraft?.category ?? category} />
            <input type="hidden" name="accent" value={productDraft?.accent ?? productCategoryConfig?.accent ?? selectedMode?.accent ?? "violet"} />
            <input type="hidden" name="badge" value={productBadge} />

            <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-product-basics">
              <header>
                <span>01</span>
                <div><h3 id="store-product-basics">Product basics</h3><p>Name it, describe it, and set pricing.</p></div>
              </header>
              <div className="grid gap-5 md:grid-cols-2">
                <FormRow label="Product name" htmlFor="product-name" error={productErrors.name}>
                  <Input id="product-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required aria-invalid={Boolean(productErrors.name)} aria-describedby={productErrors.name ? "product-name-error" : undefined} className={productErrors.name ? "border-red-500 ring-1 ring-red-500/30" : undefined} />
                </FormRow>

                <FormRow label="Price (USD)" htmlFor="product-price" error={productErrors.price}>
                  <Input id="product-price" name="price" type="number" min="0" step="0.01" defaultValue={productDraft?.price ?? 0} required aria-invalid={Boolean(productErrors.price)} aria-describedby={productErrors.price ? "product-price-error" : undefined} className={productErrors.price ? "border-red-500 ring-1 ring-red-500/30" : undefined} />
                </FormRow>

                <div className="md:col-span-2">
                  <FormRow label="Description" htmlFor="product-description" hint="Shown on cards and details" error={productErrors.description}>
                    <Textarea id="product-description" name="description" rows={3} defaultValue={productDraft?.description ?? ""} required aria-invalid={Boolean(productErrors.description)} aria-describedby={productErrors.description ? "product-description-error" : undefined} className={productErrors.description ? "border-red-500 ring-1 ring-red-500/30" : undefined} />
                  </FormRow>
                </div>

                <FormRow label="Sale price" htmlFor="product-sale" hint="Optional" error={productErrors.salePrice}>
                  <Input id="product-sale" name="salePrice" type="number" min="0" step="0.01" defaultValue={productDraft?.salePrice ?? ""} aria-invalid={Boolean(productErrors.salePrice)} aria-describedby={productErrors.salePrice ? "product-sale-error" : undefined} className={productErrors.salePrice ? "border-red-500 ring-1 ring-red-500/30" : undefined} />
                </FormRow>

                {category === "Ranks" && (
                  initialSubcategory ? (
                    <input type="hidden" name="billing" value={initialSubcategory} />
                  ) : (
                    <FormRow label="Billing period" htmlFor="product-billing" error={productErrors.billing}>
                      <Select id="product-billing" name="billing" defaultValue={productDraft?.billing ?? "Monthly"} required aria-invalid={Boolean(productErrors.billing)} aria-describedby={productErrors.billing ? "product-billing-error" : undefined} className={productErrors.billing ? "border-red-500 ring-1 ring-red-500/30" : undefined}>
                        <option>Monthly</option><option>Permanent</option>
                      </Select>
                    </FormRow>
                  )
                )}

                {category !== "Ranks" && productCategoryConfig?.useSubcategories && productCategoryConfig.subcategories.length > 0 && (
                  initialSubcategory ? (
                    <input type="hidden" name="subcategory" value={initialSubcategory} />
                  ) : (
                    <div className="md:col-span-2">
                      <FormRow label="Subcategory" htmlFor="product-subcategory" hint={`Choose where this item appears inside ${productCategoryConfig.label}`} error={productErrors.subcategory}>
                        <Select id="product-subcategory" name="subcategory" defaultValue={productDraft?.subcategory ?? productCategoryConfig.subcategories[0]?.key} required aria-invalid={Boolean(productErrors.subcategory)} aria-describedby={productErrors.subcategory ? "product-subcategory-error" : undefined} className={productErrors.subcategory ? "border-red-500 ring-1 ring-red-500/30" : undefined}>
                          {productCategoryConfig.subcategories.map((item) => <option key={item.key} value={item.key}>{item.label}{item.enabled ? "" : " · Hidden"}</option>)}
                        </Select>
                      </FormRow>
                    </div>
                  )
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
                <span>02</span>
                <div><h3 id="store-product-visuals">Artwork &amp; identity</h3><p>Upload permanent Store artwork or provide an image link.</p></div>
              </header>
              <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className={`store-admin-artwork-preview ${artworkPreview && !artworkRemoved ? "has-image" : ""}`}>
                  {artworkPreview && !artworkRemoved ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artworkPreview}
                        alt="Product artwork preview"
                        className="max-w-full max-h-full w-auto h-auto object-contain object-center p-3 relative z-10 drop-shadow-md"
                        onError={() => {
                          if (productDraft) {
                            setArtworkPreview(storeArtFor(productDraft.category));
                          }
                        }}
                      />
                      <span>Artwork preview</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus size={30} />
                      <strong>No artwork selected</strong>
                      <small>JPEG, PNG, WebP or GIF · max 8 MB</small>
                    </>
                  )}
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
                        setArtworkUrl("");
                        setArtworkChanged(true);
                        setArtworkRemoved(false);
                      }}
                    />
                    <label htmlFor="product-image-file" className="btn btn-primary"><Upload size={15} /> Choose image</label>
                    {(artworkPreview || artworkUrl) && !artworkRemoved && (
                      <button type="button" className="btn btn-secondary" onClick={() => {
                        setArtworkPreview(null);
                        setArtworkUrl("");
                        setArtworkChanged(true);
                        setArtworkRemoved(true);
                        if (artworkInput.current) artworkInput.current.value = "";
                      }}><X size={15} /> Remove</button>
                    )}
                    {productDraft && artworkChanged && (
                      <button type="button" className="btn btn-secondary" onClick={restoreArtwork}><RotateCcw size={15} /> Restore current</button>
                    )}
                  </div>
                  <input type="checkbox" name="removeArtwork" checked={artworkRemoved} readOnly hidden />
                  {productDraft && originalArtworkUrl && (
                    <div className="rounded-xl border border-line bg-surface-hover/55 px-3.5 py-3">
                      <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted">Current image path</span>
                      <code className="mt-1.5 block break-all text-xs font-semibold text-foreground">{originalArtworkUrl}</code>
                    </div>
                  )}
                  <FormRow label="Or paste an artwork URL" htmlFor="product-art" hint="External links are copied to storage" error={productErrors.imageFile ?? productErrors.imageUrl}>
                    <Input id="product-art" name="imageUrl" value={artworkUrl} onChange={(event) => {
                      const nextUrl = event.target.value;
                      setArtworkUrl(nextUrl);
                      setArtworkPreview(nextUrl || null);
                      setArtworkChanged(nextUrl !== originalArtworkUrl);
                      setArtworkRemoved(false);
                      if (artworkInput.current) artworkInput.current.value = "";
                    }} placeholder="https://… or /images/store/…" aria-invalid={Boolean(productErrors.imageFile ?? productErrors.imageUrl)} aria-describedby={(productErrors.imageFile ?? productErrors.imageUrl) ? "product-art-error" : undefined} className={(productErrors.imageFile ?? productErrors.imageUrl) ? "border-red-500 ring-1 ring-red-500/30" : undefined} />
                  </FormRow>
                  <div>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div><strong className="text-sm">Product badge</strong><p className="mt-0.5 text-xs text-muted">Optional label shown on storefront cards.</p></div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">Select one</span>
                    </div>
                    <div className="store-admin-category-options">
                      {PRODUCT_BADGE_OPTIONS.map(({ value, label, icon: BadgeIcon }) => (
                        <label key={value || "none"} className={productBadge === value ? "is-selected" : ""}>
                          <input type="radio" name="badgeChoice" value={value} checked={productBadge === value} onChange={() => setProductBadge(value)} />
                          <span><BadgeIcon size={17} /></span>
                          <strong>{label}</strong>
                          <small>{value || "No badge"}</small>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-product-details">
              <header>
                <span>03</span>
                <div><h3 id="store-product-details">Included details</h3><p>Each line becomes a benefit on the public product page.</p></div>
              </header>
              <FormRow label="Included features" htmlFor="product-features" hint="One per line" error={productErrors.features}>
                <Textarea id="product-features" name="features" rows={5} defaultValue={productDraft?.features.join("\n") ?? ""} placeholder="Permanent access&#10;Survival SMP&#10;Staff delivery" aria-invalid={Boolean(productErrors.features)} aria-describedby={productErrors.features ? "product-features-error" : undefined} className={productErrors.features ? "border-red-500 ring-1 ring-red-500/30" : undefined} />
              </FormRow>
            </section>

            <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={productDraft?.enabled ?? true} className="h-4 w-4 accent-violet-500" />
              <span><strong>Publish this product</strong><small className="mt-0.5 block font-normal text-muted">Enabled products appear immediately in the assigned game mode Store.</small></span>
            </label>
          </div>
          <div className="store-admin-modal-actions flex justify-end gap-2 border-t border-line px-6 py-4">
            {productDraft && <button type="reset" className="btn btn-secondary mr-auto" onClick={() => openProduct(productDraft)}><RotateCcw size={15} /> Reset changes</button>}
            <button type="button" className="btn btn-secondary" onClick={() => setProductDraft(undefined)}>Cancel</button>
            <button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : "Save product"}</button>
          </div>
        </form>
      </Modal>
      <Modal open={categoryDraft !== undefined} onClose={() => setCategoryDraft(undefined)} label={categoryDraft ? "Edit Store category" : "Create Store category"} size="editor">
        {categoryDraft !== undefined && selectedMode && (
          <form key={`${selectedMode.slug}:${categoryDraft?.key ?? "new-category"}`} action={(data) => submit(data, saveStoreCategoryAction, () => setCategoryDraft(undefined))} className="store-admin-modal panel overflow-hidden">
            <div className="store-admin-modal-head border-b border-line px-6 py-5">
              <div>
                <p className="eyebrow">{selectedMode.name} marketplace</p>
                <h2 className="mt-2 text-2xl font-black">{categoryDraft ? `Edit ${categoryDraft.label}` : "Create category"}</h2>
                <p className="mt-1 text-sm text-muted">{categoryDraft ? "Update this category's public presentation and visibility." : "Create a custom category for this game mode and assign products to it."}</p>
              </div>
            </div>
            <div className="grid gap-5 p-6 md:grid-cols-2">
              <input type="hidden" name="gameModeSlug" value={selectedMode.slug} />
              <input type="hidden" name="key" value={categoryDraft?.key ?? ""} />
              <input type="hidden" name="accent" value={categoryDraft?.accent ?? "violet"} />
              <input type="hidden" name="sortOrder" value={categoryDraft?.sortOrder ?? modeCategories.length * 10} />
              <input type="hidden" name="icon" value={categoryIcon} />

              <FormRow label="Display name" htmlFor="category-label" hint="Type custom name or select Minecraft preset">
                <Input
                  id="category-label"
                  name="label"
                  value={categoryLabelValue}
                  onChange={(event) => setCategoryLabelValue(event.target.value)}
                  placeholder="Ranks, Crate Keys, Battlepass, Add-ons…"
                  required
                />
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted mr-1">Presets:</span>
                  {MINECRAFT_LABEL_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        categoryLabelValue === preset.label
                          ? "bg-violet-500/25 border-violet-500/60 text-violet-300 font-bold"
                          : "bg-surface-hover/60 border-line text-muted hover:text-foreground hover:border-line-hover"
                      }`}
                      onClick={() => {
                        setCategoryLabelValue(preset.label);
                        setCategoryEyebrowValue(preset.eyebrow);
                        setCategoryIcon(preset.icon);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </FormRow>

              <FormRow label="Category label" htmlFor="category-eyebrow" hint="Type custom label or select badge preset">
                <Input
                  id="category-eyebrow"
                  name="eyebrow"
                  value={categoryEyebrowValue}
                  onChange={(event) => setCategoryEyebrowValue(event.target.value)}
                  placeholder="Progression, Rewards, Seasonal…"
                  required
                />
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted mr-1">Badges:</span>
                  {MINECRAFT_EYEBROW_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        categoryEyebrowValue === preset
                          ? "bg-violet-500/25 border-violet-500/60 text-violet-300 font-bold"
                          : "bg-surface-hover/60 border-line text-muted hover:text-foreground hover:border-line-hover"
                      }`}
                      onClick={() => setCategoryEyebrowValue(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </FormRow>

              <div className="md:col-span-2">
                <FormRow label="Description" htmlFor="category-description">
                  <Textarea id="category-description" name="description" rows={3} defaultValue={categoryDraft?.description ?? "Store products for this game mode."} required />
                </FormRow>
              </div>

              <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-category-icon">
                <header>
                  <span>Icon</span>
                  <div>
                    <h3 id="store-category-icon">Category icon</h3>
                    <p>Shown on category tabs, cards, and storefront lists.</p>
                  </div>
                </header>
                <div className="store-admin-category-options">
                  {MODE_ICON_OPTIONS.map(({ value, label, icon: OptIcon }) => (
                    <label key={value} className={categoryIcon === value ? "is-selected" : ""}>
                      <input type="radio" name="iconChoice" value={value} checked={categoryIcon === value} onChange={() => setCategoryIcon(value)} />
                      <span><OptIcon size={17} /></span>
                      <strong>{label}</strong>
                      <small>{value}</small>
                    </label>
                  ))}
                </div>
              </section>

              {!categoryDraft && (
                <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold md:col-span-2">
                  <input type="checkbox" name="useSubcategories" defaultChecked={false} className="h-4 w-4 accent-violet-500" />
                  <span><strong>Use subcategories</strong><small className="mt-0.5 block font-normal text-muted">This category opens subcategory cards before its item dashboard.</small></span>
                </label>
              )}
              <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold md:col-span-2">
                <input type="checkbox" name="enabled" defaultChecked={categoryDraft?.enabled ?? true} className="h-4 w-4 accent-violet-500" />
                <span><strong>Show this category</strong><small className="mt-0.5 block font-normal text-muted">Enabled categories appear in the public Store.</small></span>
              </label>
            </div>
            <div className="store-admin-modal-actions flex justify-end gap-2 border-t border-line px-6 py-4">
              {categoryDraft && <button type="reset" className="btn btn-secondary mr-auto" onClick={() => openCategory(categoryDraft)}><RotateCcw size={15} /> Reset changes</button>}
              <button type="button" className="btn btn-secondary" onClick={() => setCategoryDraft(undefined)}>Cancel</button>
              <button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : categoryDraft ? "Save category" : "Create category"}</button>
            </div>
          </form>
        )}
      </Modal>
      <GameModeFormModal draft={modeDraft} modesCount={modes.length} onClose={() => setModeDraft(undefined)} />
    </>
  );
}
