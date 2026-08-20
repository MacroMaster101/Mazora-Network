"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { getProducts } from "@/lib/data/content";
import { normaliseCode } from "@/lib/data/creator-codes";
import { MAX_PERCENT_OFF } from "@/lib/store-discount";
import { throttleAuthAction } from "@/lib/rate-limit";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageStore } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { SOCIAL_PLATFORM_KEYS, isValidSocialUrl, type SocialPlatform } from "@/lib/creator-socials";
// Not exported from this module on purpose: every export of a "use server"
// file becomes a browser-callable endpoint. See creator-code-resolve.ts.
import { resolveCreatorCode } from "@/lib/creator-code-resolve";

async function requireStoreEditor() {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  return session && (await canManageStore(session, userId)) ? session : null;
}

export interface CreatorCodePreviewResult {
  ok: boolean;
  /** Normalised code, echoed back so the form can store what was accepted. */
  code?: string;
  codeType?: "creator" | "event";
  creatorName?: string;
  percentOff?: number;
  subtotal?: number;
  discount?: number;
  total?: number;
  /** Names of the lines the code actually discounted. */
  appliedTo?: string[];
  message?: string;
}

/**
 * Checkout preview. Rate-limited so the endpoint cannot be used to enumerate
 * codes at speed, and deliberately gives one generic answer for unknown,
 * disabled and expired codes alike.
 */
export async function previewCreatorCode(
  _previous: CreatorCodePreviewResult,
  formData: FormData,
): Promise<CreatorCodePreviewResult> {
  const raw = normaliseCode(String(formData.get("creatorCode") ?? ""));
  if (!raw || raw.length > 40) {
    return { ok: false, message: "Enter a discount code." };
  }

  const throttled = await throttleAuthAction("creator-code", {
    limit: 20,
    windowMs: 5 * 60_000,
  });
  if (throttled) {
    return { ok: false, message: "Too many code attempts. Please wait a few minutes." };
  }

  let submitted: { slug: string; qty: number }[] = [];
  try {
    submitted = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, message: "Your cart could not be read. Refresh and try again." };
  }
  if (!Array.isArray(submitted)) {
    return { ok: false, message: "Your cart could not be read. Refresh and try again." };
  }
  // Mirrors the `.max(20)` entry ceiling on `itemsSchema` in
  // `src/lib/actions/store.ts` — the preview must not let a caller do more
  // work than the order it is previewing would ever allow.
  if (submitted.length > 20) {
    return { ok: false, message: "Your cart contains too many different products." };
  }

  // Merge duplicate slugs before pricing. Submitting the same slug across
  // several entries must not let a caller stack past the per-product
  // quantity ceiling below — one line per product, matching what the order
  // path will record.
  const quantityBySlug = new Map<string, number>();
  for (const item of submitted) {
    const slug = String(item?.slug ?? "");
    if (!slug) continue;
    const parsedQty = Number(item?.qty);
    // A non-numeric qty must not flow through as NaN, even though
    // applyCreatorCode's finite-guard would otherwise neutralise it silently.
    const qty = Number.isFinite(parsedQty) ? Math.trunc(parsedQty) : 1;
    quantityBySlug.set(slug, (quantityBySlug.get(slug) ?? 0) + qty);
  }

  // The preview prices from the database exactly as checkout does, so the
  // number shown here is the number the order will carry.
  const products = await getProducts();
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  const lines = Array.from(quantityBySlug.entries()).flatMap(([slug, qty]) => {
    const product = bySlug.get(slug);
    // A product with no id cannot be matched against the eligibility list, so
    // it simply participates at full price rather than blocking the preview.
    if (!product?.id) return [];
    const quantity = Math.min(Math.max(qty, 1), 20);
    return [{
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.salePrice ?? product.price,
    }];
  });

  if (lines.length === 0) return { ok: false, message: "Your cart is empty." };

  const outcome = await resolveCreatorCode(raw, lines);
  if (!outcome.ok) {
    return {
      ok: false,
      message:
        outcome.reason === "not_applicable"
          ? "That code doesn't apply to anything in your cart."
          : "That discount code isn't valid.",
    };
  }

  const { code, result } = outcome.resolved;
  return {
    ok: true,
    code: code.code,
    codeType: code.codeType,
    creatorName: code.creatorName,
    percentOff: code.percentOff,
    subtotal: result.subtotal,
    discount: result.discount,
    total: result.total,
    appliedTo: result.lines.filter((line) => line.lineDiscount > 0).map((line) => line.name),
  };
}

export interface CreatorCodeActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const codeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(3, "Codes are at least 3 characters.")
    .max(40, "Codes are at most 40 characters.")
    .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, hyphens and underscores."),
  codeType: z.enum(["creator", "event"]),
  creatorName: z.string().trim().min(1, "Enter a creator or event name.").max(80),
  discordUsername: z
    .string()
    .trim()
    .max(32, "Discord usernames are at most 32 characters.")
    .regex(/^[a-zA-Z0-9._#]*$/, "That is not a Discord username.")
    .optional()
    .or(z.literal("")),
  socials: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORM_KEYS as [SocialPlatform, ...SocialPlatform[]]),
        // Parsed with the URL constructor and protocol-allowlisted, so a
        // `javascript:` value can never be stored and later clicked in the admin.
        url: z.string().trim().max(300).refine(isValidSocialUrl, "Enter a full http(s) link."),
      }),
    )
    .max(SOCIAL_PLATFORM_KEYS.length, "Too many social links."),
  percentOff: z.coerce
    .number()
    .int("Use a whole number.")
    .min(1, "The discount must be at least 1%.")
    .max(MAX_PERCENT_OFF, `The discount cannot exceed ${MAX_PERCENT_OFF}%.`),
  enabled: z.coerce.boolean(),
  expiresAt: z.string().trim().optional().or(z.literal("")),
  internalNote: z.string().trim().max(500).optional().or(z.literal("")),
  productIds: z.array(z.string().uuid()).max(500),
});

export async function saveCreatorCode(
  _previous: CreatorCodeActionResult,
  formData: FormData,
): Promise<CreatorCodeActionResult> {
  const session = await requireStoreEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage Store codes." };

  let productIds: unknown = [];
  let socials: unknown = [];
  try {
    productIds = JSON.parse(String(formData.get("productIds") ?? "[]"));
    socials = JSON.parse(String(formData.get("socials") ?? "[]"));
  } catch {
    return { ok: false, message: "The submitted form could not be read." };
  }

  const parsed = codeSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    codeType: formData.get("codeType") || "creator",
    creatorName: formData.get("creatorName"),
    discordUsername: formData.get("discordUsername") || "",
    socials,
    percentOff: formData.get("percentOff"),
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    expiresAt: formData.get("expiresAt") || "",
    internalNote: formData.get("internalNote") || "",
    productIds,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "No database is configured." };

  const code = normaliseCode(parsed.data.code);
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return { ok: false, errors: { expiresAt: "That is not a valid date." } };
  }

  let codeId: string | undefined;
  try {
    // Uniqueness is checked here for a clean message, and enforced by the
    // unique index regardless — the check alone would race two concurrent saves.
    const clash = await db
      .select({ id: schema.creatorCodes.id })
      .from(schema.creatorCodes)
      .where(
        parsed.data.id
          ? and(eq(schema.creatorCodes.code, code), ne(schema.creatorCodes.id, parsed.data.id))
          : eq(schema.creatorCodes.code, code),
      )
      .limit(1);
    if (clash.length > 0) return { ok: false, errors: { code: "That code already exists." } };

    await db.transaction(async (tx) => {
      const values = {
        code,
        codeType: parsed.data.codeType,
        creatorName: parsed.data.creatorName,
        discordUsername: parsed.data.codeType === "creator" ? parsed.data.discordUsername || null : null,
        socials: parsed.data.codeType === "creator" ? parsed.data.socials : [],
        percentOff: parsed.data.percentOff,
        enabled: parsed.data.enabled,
        expiresAt,
        internalNote: parsed.data.internalNote || null,
        updatedAt: new Date(),
      };

      codeId = parsed.data.id
        ? (await tx
            .update(schema.creatorCodes)
            .set(values)
            .where(eq(schema.creatorCodes.id, parsed.data.id))
            .returning({ id: schema.creatorCodes.id }))[0]?.id
        : (await tx
            .insert(schema.creatorCodes)
            .values(values)
            .returning({ id: schema.creatorCodes.id }))[0]?.id;

      if (!codeId) throw new Error("Creator code write returned no row.");

      // Replace the eligibility list wholesale — it is a set, and diffing it
      // would be more code for the same result.
      await tx.delete(schema.creatorCodeProducts).where(eq(schema.creatorCodeProducts.codeId, codeId));
      if (parsed.data.productIds.length > 0) {
        await tx.insert(schema.creatorCodeProducts).values(
          parsed.data.productIds.map((productId) => ({ codeId: codeId as string, productId })),
        );
      }
    });
  } catch (error) {
    console.error("Failed to save creator code", error);
    return { ok: false, message: "The code could not be saved." };
  }

  // Audit only after the transaction has committed, so a failed save never
  // leaves a log entry claiming a change that did not happen.
  await db.insert(schema.auditLogs).values({
    action: "creator_code.save",
    targetType: "creator_code",
    targetId: codeId ?? null,
    metadata: {
      code,
      codeType: parsed.data.codeType,
      creatorName: parsed.data.creatorName,
      percentOff: parsed.data.percentOff,
      enabled: parsed.data.enabled,
      productCount: parsed.data.productIds.length,
      by: session.username,
    },
  });

  revalidatePath("/admin/store/creator-codes");
  revalidatePath("/admin/store/creator-codes/creators");
  revalidatePath("/admin/store/creator-codes/events");
  revalidatePath("/admin/store");
  return { ok: true, message: `Saved ${code}.` };
}

export async function deleteCreatorCode(
  _previous: CreatorCodeActionResult,
  formData: FormData,
): Promise<CreatorCodeActionResult> {
  const session = await requireStoreEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage Store codes." };

  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, message: "That code could not be identified." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "No database is configured." };

  // Capture the code's details before deleting the row — afterwards they are
  // gone and the audit entry would have nothing to describe.
  const [existing] = await db
    .select({
      code: schema.creatorCodes.code,
      creatorName: schema.creatorCodes.creatorName,
      codeType: schema.creatorCodes.codeType,
      percentOff: schema.creatorCodes.percentOff,
      enabled: schema.creatorCodes.enabled,
    })
    .from(schema.creatorCodes)
    .where(eq(schema.creatorCodes.id, id))
    .limit(1);
  if (!existing) return { ok: false, message: "That code could not be found." };

  const productCount = (
    await db
      .select({ productId: schema.creatorCodeProducts.productId })
      .from(schema.creatorCodeProducts)
      .where(eq(schema.creatorCodeProducts.codeId, id))
  ).length;

  try {
    // Past orders keep their text snapshot and recorded discount; only the
    // foreign key goes null (on delete set null).
    await db.delete(schema.creatorCodes).where(eq(schema.creatorCodes.id, id));
  } catch (error) {
    console.error("Failed to delete creator code", error);
    return { ok: false, message: "The code could not be deleted." };
  }

  // Audit only after the delete has succeeded, so a failed delete never
  // leaves a log entry claiming a change that did not happen.
  await db.insert(schema.auditLogs).values({
    action: "creator_code.delete",
    targetType: "creator_code",
    targetId: id,
    metadata: {
      code: existing.code,
      codeType: existing.codeType,
      creatorName: existing.creatorName,
      percentOff: existing.percentOff,
      enabled: existing.enabled,
      productCount,
      by: session.username,
    },
  });

  revalidatePath("/admin/store/creator-codes");
  revalidatePath("/admin/store/creator-codes/creators");
  revalidatePath("/admin/store/creator-codes/events");
  revalidatePath("/admin/store");
  return { ok: true, message: "Code deleted." };
}
