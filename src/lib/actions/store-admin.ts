"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId, hasAtLeast } from "@/lib/auth";
import { getDb, schema } from "@/lib/db/client";
import { rehostImageFromUrl, storeImageBytes } from "@/lib/news/image-store";

export interface StoreAdminActionResult {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
}

const accents = ["green", "gold", "cyan", "rose", "violet", "orange"] as const;

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a product name.").max(100),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
  description: z.string().trim().min(5, "Add a short description.").max(1000),
  category: z.string().trim().min(1, "Choose a category.").max(60),
  price: z.coerce.number().min(0).max(100000),
  salePrice: z.union([z.literal(""), z.coerce.number().min(0).max(100000)]),
  imageUrl: z.string().trim().max(1000),
  features: z.string().max(3000),
  accent: z.enum(accents),
  badge: z.string().trim().max(50),
  family: z.string().trim().max(80),
  billing: z.enum(["", "Monthly", "Permanent"]),
  subcategory: z.string().trim().max(60),
  gameModeSlug: z.string().trim().min(1).max(100),
  sortOrder: z.coerce.number().int().min(-10000).max(10000),
  enabled: z.boolean(),
});

const modeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a mode name.").max(80),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
  description: z.string().trim().max(1000),
  tagline: z.string().trim().max(120),
  version: z.string().trim().min(1).max(30),
  icon: z.string().trim().min(1).max(60),
  accent: z.enum(accents),
  storeStatus: z.enum(["live", "coming_soon"]),
  features: z.string().max(3000),
  rules: z.string().max(3000),
  commands: z.string().max(4000),
  sortOrder: z.coerce.number().int().min(-10000).max(10000),
  enabled: z.boolean(),
});

async function admin() {
  const session = await getSession();
  return session && hasAtLeast(session.role, "administrator") ? session : null;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    output[key] ??= issue.message;
  }
  return output;
}

function refreshStore(slug?: string) {
  revalidatePath("/store");
  revalidatePath("/admin/store");
  revalidatePath("/admin/store/catalog");
  revalidatePath("/admin/game-modes");
  revalidatePath("/game-modes");
  if (slug) {
    revalidatePath(`/store/${slug}`);
    revalidatePath(`/game-modes/${slug}`);
  }
}

function isOwnStorageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return false;
  try {
    return url.startsWith(new URL(base).origin);
  } catch {
    return false;
  }
}

async function resolveStoreArtwork(
  formData: FormData,
  keyBase: string,
  currentUrl: string | null,
): Promise<{ url: string | null; error?: string }> {
  if (formData.get("removeArtwork") === "on") return { url: null };

  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) return { url: currentUrl, error: "Artwork must be under 8 MB." };
    const stored = await storeImageBytes(new Uint8Array(await file.arrayBuffer()), `store/${keyBase}-${Date.now()}`);
    if (!stored) return { url: currentUrl, error: "Use a real JPEG, PNG, WebP or GIF under 8 MB." };
    return { url: stored.url };
  }

  const raw = text(formData, "imageUrl").trim();
  if (!raw) return { url: currentUrl };
  if (raw.startsWith("/") || isOwnStorageUrl(raw) || raw === currentUrl) return { url: raw };

  const hosted = await rehostImageFromUrl(raw, `store/${keyBase}-${Date.now()}`);
  if (!hosted) return { url: currentUrl, error: "That artwork link could not be fetched as an image under 8 MB." };
  return { url: hosted.url };
}

function productInput(formData: FormData) {
  return productSchema.safeParse({
    id: text(formData, "id") || undefined,
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    category: text(formData, "category"),
    price: text(formData, "price"),
    salePrice: text(formData, "salePrice"),
    imageUrl: text(formData, "imageUrl"),
    features: text(formData, "features"),
    accent: text(formData, "accent"),
    badge: text(formData, "badge"),
    family: text(formData, "family"),
    billing: text(formData, "billing"),
    subcategory: text(formData, "subcategory"),
    gameModeSlug: text(formData, "gameModeSlug"),
    sortOrder: text(formData, "sortOrder") || "0",
    enabled: formData.get("enabled") === "on",
  });
}

function modeInput(formData: FormData) {
  return modeSchema.safeParse({
    id: text(formData, "id") || undefined,
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    tagline: text(formData, "tagline"),
    version: text(formData, "version"),
    icon: text(formData, "icon"),
    accent: text(formData, "accent"),
    storeStatus: text(formData, "storeStatus"),
    features: text(formData, "features"),
    rules: text(formData, "rules"),
    commands: text(formData, "commands"),
    sortOrder: text(formData, "sortOrder") || "0",
    enabled: formData.get("enabled") === "on",
  });
}

export async function saveStoreProductAction(formData: FormData): Promise<StoreAdminActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: "You do not have permission to manage Store products." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const parsed = productInput(formData);
  if (!parsed.success) return { ok: false, message: "Check the highlighted product fields.", errors: errors(parsed.error) };
  const value = parsed.data;
  const [duplicate] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(value.id ? and(eq(schema.products.slug, value.slug), ne(schema.products.id, value.id)) : eq(schema.products.slug, value.slug))
    .limit(1);
  if (duplicate) return { ok: false, message: "Another product already uses that slug.", errors: { slug: "Slug already in use." } };

  const before = value.id
    ? (await db.select().from(schema.products).where(eq(schema.products.id, value.id)).limit(1))[0]
    : null;
  const artwork = await resolveStoreArtwork(formData, value.id ?? value.slug, before?.imageUrl ?? null);
  if (artwork.error) return { ok: false, message: artwork.error, errors: { imageFile: artwork.error } };

  const patch = {
    name: value.name,
    slug: value.slug,
    description: value.description,
    category: value.category,
    price: value.price.toFixed(2),
    salePrice: value.salePrice === "" ? null : value.salePrice.toFixed(2),
    imageUrl: artwork.url,
    features: value.features.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    accent: value.accent,
    badge: value.badge || null,
    family: value.category === "Ranks" ? value.family || null : null,
    billing: value.category === "Ranks" ? value.billing || null : null,
    subcategory: value.category === "Ranks" ? null : value.subcategory || null,
    gameModeSlug: value.gameModeSlug,
    sortOrder: value.sortOrder,
    enabled: value.enabled,
    updatedAt: new Date(),
  };
  const [saved] = value.id
    ? await db.update(schema.products).set(patch).where(eq(schema.products.id, value.id)).returning()
    : await db.insert(schema.products).values(patch).returning();
  if (!saved) return { ok: false, message: "The product could not be saved." };

  await db.insert(schema.auditLogs).values({
    actorId: await getSessionUserId(),
    action: value.id ? "store.product.update" : "store.product.create",
    targetType: "product",
    targetId: saved.id,
    metadata: { by: session.username, before, after: saved },
  });
  refreshStore(before?.slug);
  refreshStore(saved.slug);
  return { ok: true, message: value.id ? "Product updated." : "Product created." };
}

export async function toggleStoreProductAction(formData: FormData): Promise<StoreAdminActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: "You do not have permission to manage Store products." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const id = text(formData, "id");
  const enabled = text(formData, "enabled") === "true";
  const [saved] = await db.update(schema.products).set({ enabled, updatedAt: new Date() }).where(eq(schema.products.id, id)).returning();
  if (!saved) return { ok: false, message: "That product no longer exists." };
  await db.insert(schema.auditLogs).values({
    actorId: await getSessionUserId(),
    action: enabled ? "store.product.enable" : "store.product.disable",
    targetType: "product",
    targetId: saved.id,
    metadata: { by: session.username, slug: saved.slug },
  });
  refreshStore(saved.slug);
  return { ok: true, message: enabled ? "Product is live." : "Product hidden from the Store." };
}

export async function saveStoreModeAction(formData: FormData): Promise<StoreAdminActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: "You do not have permission to manage Store modes." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const parsed = modeInput(formData);
  if (!parsed.success) return { ok: false, message: "Check the highlighted mode fields.", errors: errors(parsed.error) };
  const value = parsed.data;
  const [duplicate] = await db
    .select({ id: schema.gameModes.id })
    .from(schema.gameModes)
    .where(value.id ? and(eq(schema.gameModes.slug, value.slug), ne(schema.gameModes.id, value.id)) : eq(schema.gameModes.slug, value.slug))
    .limit(1);
  if (duplicate) return { ok: false, message: "Another mode already uses that slug.", errors: { slug: "Slug already in use." } };
  const patch = {
    name: value.name,
    slug: value.slug,
    description: value.description || null,
    tagline: value.tagline || null,
    version: value.version,
    icon: value.icon,
    accent: value.accent,
    storeStatus: value.storeStatus,
    features: value.features.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    rules: value.rules.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    commands: value.commands
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [cmd, ...rest] = line.split("|");
        return { cmd: cmd.trim(), desc: rest.join("|").trim() };
      })
      .filter((c) => c.cmd),
    sortOrder: value.sortOrder,
    enabled: value.enabled,
    updatedAt: new Date(),
  };
  const before = value.id
    ? (await db.select().from(schema.gameModes).where(eq(schema.gameModes.id, value.id)).limit(1))[0]
    : null;
  const [saved] = value.id
    ? await db.update(schema.gameModes).set(patch).where(eq(schema.gameModes.id, value.id)).returning()
    : await db.insert(schema.gameModes).values(patch).returning();
  if (!saved) return { ok: false, message: "The game mode could not be saved." };
  await db.insert(schema.auditLogs).values({
    actorId: await getSessionUserId(),
    action: value.id ? "store.mode.update" : "store.mode.create",
    targetType: "game_mode",
    targetId: saved.id,
    metadata: { by: session.username, before, after: saved },
  });
  refreshStore(saved.slug);
  return { ok: true, message: value.id ? "Game mode updated." : "Game mode created." };
}

export async function toggleStoreModeAction(formData: FormData): Promise<StoreAdminActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: "You do not have permission to manage Store modes." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const id = text(formData, "id");
  const enabled = text(formData, "enabled") === "true";
  const [saved] = await db.update(schema.gameModes).set({ enabled, updatedAt: new Date() }).where(eq(schema.gameModes.id, id)).returning();
  if (!saved) return { ok: false, message: "That game mode no longer exists." };
  await db.insert(schema.auditLogs).values({
    actorId: await getSessionUserId(),
    action: enabled ? "store.mode.enable" : "store.mode.disable",
    targetType: "game_mode",
    targetId: saved.id,
    metadata: { by: session.username, slug: saved.slug },
  });
  refreshStore();
  return { ok: true, message: enabled ? "Game mode shown in the Store." : "Game mode hidden from the Store." };
}


export async function deleteStoreProductAction(formData: FormData): Promise<StoreAdminActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: "You do not have permission to delete Store products." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const id = text(formData, "id");
  const [before] = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!before) return { ok: false, message: "That product no longer exists." };
  await db.delete(schema.products).where(eq(schema.products.id, id));
  await db.insert(schema.auditLogs).values({
    actorId: await getSessionUserId(),
    action: "store.product.delete",
    targetType: "product",
    targetId: before.id,
    metadata: { by: session.username, before },
  });
  refreshStore(before.slug);
  revalidatePath(`/admin/store/catalog/${before.gameModeSlug}`);
  return { ok: true, message: `${before.name} deleted.` };
}

export async function deleteStoreModeAction(formData: FormData): Promise<StoreAdminActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: "You do not have permission to delete Store modes." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  const id = text(formData, "id");
  const [before] = await db.select().from(schema.gameModes).where(eq(schema.gameModes.id, id)).limit(1);
  if (!before) return { ok: false, message: "That game mode no longer exists." };
  const [child] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.gameModeSlug, before.slug)).limit(1);
  if (child) return { ok: false, message: "Delete or move this game mode's products before deleting the game mode." };
  await db.delete(schema.gameModes).where(eq(schema.gameModes.id, id));
  await db.insert(schema.auditLogs).values({
    actorId: await getSessionUserId(),
    action: "store.mode.delete",
    targetType: "game_mode",
    targetId: before.id,
    metadata: { by: session.username, before },
  });
  refreshStore();
  return { ok: true, message: `${before.name} deleted.` };
}



