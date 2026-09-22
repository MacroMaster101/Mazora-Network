"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageStore } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { isValidSocialUrl } from "@/lib/creator-socials";
import {
  getStoreInvoiceDetails,
  STORE_INVOICE_DETAILS_KEY,
} from "@/lib/data/store-settings";

export interface InvoiceActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

async function storeEditor() {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  return session && (await canManageStore(session, userId)) ? session : null;
}

/**
 * Accepts the bare form the invoice header is normally given ("mazora.us"),
 * which the sheet renders by prefixing https://. Anything with a scheme must
 * go through isValidSocialUrl instead, so only http(s) survives.
 */
function isBareDomain(value: string): boolean {
  if (value.includes(":") || value.includes("/")) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value);
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.find((part) => typeof part === "string");
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/*
  The adjustment is the only figure staff type that is not derived from a line,
  so it is bounded and parsed as a number rather than trusted as text. Signed on
  purpose: a negative value is a credit.
*/
const adjustmentField = z.coerce
  .number()
  .min(-100000, "That adjustment is out of range.")
  .max(100000, "That adjustment is out of range.")
  .refine(Number.isFinite, "Enter a number.");

const invoiceNoField = z
  .string()
  .trim()
  .min(1, "Give the invoice a number.")
  .max(60, "Invoice numbers are at most 60 characters.");

/** A date input gives "YYYY-MM-DD" with no zone; UTC midnight keeps the printed date stable. */
function parseIssuedAt(value: string): Date | null {
  if (!value) return new Date();
  const candidate = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

/** The invoice number is unique across invoices, so a clash is the likely failure. */
function duplicateNumber(error: unknown): boolean {
  return String((error as { message?: string })?.message ?? "").includes("order_invoices_invoice_no_idx");
}

/*
  A standalone invoice carries its own lines, because the sale it documents was
  arranged in Discord and never became an `orders` row. Prices are accepted from
  the form rather than looked up: staff price these by hand, and a Discord deal
  is frequently not the catalogue price. The product id is kept when they picked
  a catalogue item so reporting can still tie the line back to it.
*/
const lineSchema = z.object({
  productId: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Every line needs a description.").max(160),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(999),
  unitPrice: z.coerce.number().min(0, "Prices cannot be negative.").max(100000),
  discountPercent: z.coerce.number().int().min(0).max(100, "Discounts run from 0 to 100%."),
});

const standaloneSchema = z.object({
  invoiceNo: invoiceNoField,
  buyerName: z.string().trim().min(1, "Who is this invoice for?").max(120),
  buyerDiscord: z.string().trim().max(120).optional().or(z.literal("")),
  adjustment: adjustmentField,
  notes: z.string().trim().max(600, "Notes are at most 600 characters.").optional().or(z.literal("")),
  issuedAt: z.string().trim().optional().or(z.literal("")),
  items: z.array(lineSchema).min(1, "Add at least one item.").max(50, "That is too many lines."),
});

/** Raises a manual invoice for a sale that has no website order behind it. */
export async function createStandaloneInvoiceAction(
  _previous: InvoiceActionResult,
  formData: FormData,
): Promise<InvoiceActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to issue invoices." };

  let items: unknown = [];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, message: "The submitted form could not be read." };
  }

  const parsed = standaloneSchema.safeParse({
    invoiceNo: formData.get("invoiceNo"),
    buyerName: formData.get("buyerName"),
    buyerDiscord: formData.get("buyerDiscord") || "",
    adjustment: formData.get("adjustment") || 0,
    notes: formData.get("notes") || "",
    issuedAt: formData.get("issuedAt") || "",
    items,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const issuedAt = parseIssuedAt(parsed.data.issuedAt ?? "");
  if (!issuedAt) return { ok: false, errors: { issuedAt: "Enter a valid date." } };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(schema.orderInvoices)
        .values({
          orderId: null,
          invoiceNo: parsed.data.invoiceNo,
          billedTo: parsed.data.buyerName,
          buyerName: parsed.data.buyerName,
          buyerDiscord: parsed.data.buyerDiscord || null,
          adjustment: parsed.data.adjustment.toFixed(2),
          notes: parsed.data.notes || null,
          issuedAt,
          // The staff member who raised it on the website, not a Discord actor.
          issuedBy: session.username,
        })
        .returning({ id: schema.orderInvoices.id });
      if (!invoice) throw new Error("Invoice write returned no row.");

      await tx.insert(schema.invoiceItems).values(
        parsed.data.items.map((item, index) => ({
          invoiceId: invoice.id,
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          discountPercent: item.discountPercent,
          sortOrder: index,
        })),
      );
    });
  } catch (error) {
    console.error("Failed to create invoice", error);
    if (duplicateNumber(error)) {
      return { ok: false, errors: { invoiceNo: "That invoice number is already used." } };
    }
    return { ok: false, message: "The invoice could not be created." };
  }

  await db.insert(schema.auditLogs).values({
    action: "store.invoice.create",
    targetType: "invoice",
    targetId: null,
    metadata: {
      by: session.username,
      invoiceNo: parsed.data.invoiceNo,
      buyer: parsed.data.buyerName,
      lines: parsed.data.items.length,
    },
  });

  revalidatePath("/admin/orders");
  return { ok: true, message: `Invoice ${parsed.data.invoiceNo} created.` };
}

const detailsSchema = z.object({
  businessName: z.string().trim().min(1, "Enter a business name.").max(80),
  /*
    Protocol-allowlisted with the same helper the social links use. The sheet
    prefixes a bare domain with https://, so a `javascript:` value could not
    reach the href anyway — but validating here keeps every stored URL in the
    admin held to one rule, and rejects confusing input like `httpx://…` at the
    point someone types it rather than when a buyer clicks it.
  */
  website: z
    .string()
    .trim()
    .max(120)
    .refine((value) => !value || isValidSocialUrl(value) || isBareDomain(value), "Enter a domain or a full http(s) link.")
    .optional()
    .or(z.literal("")),
  addressLines: z.array(z.string().trim().max(120)).max(4),
  postcode: z.string().trim().max(40).optional().or(z.literal("")),
  footerNote: z.string().trim().max(400).optional().or(z.literal("")),
});

/** Saves the issuer block printed at the top of every invoice. */
export async function saveInvoiceDetailsAction(
  _previous: InvoiceActionResult,
  formData: FormData,
): Promise<InvoiceActionResult> {
  const session = await storeEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage Store settings." };

  const parsed = detailsSchema.safeParse({
    businessName: formData.get("businessName"),
    website: formData.get("website") || "",
    // Blank rows are dropped here so the stored value matches what prints.
    addressLines: String(formData.get("addressLines") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4),
    postcode: formData.get("postcode") || "",
    footerNote: formData.get("footerNote") || "",
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const before = await getStoreInvoiceDetails();
  const value = {
    businessName: parsed.data.businessName,
    website: parsed.data.website || "",
    addressLines: parsed.data.addressLines,
    postcode: parsed.data.postcode || "",
    footerNote: parsed.data.footerNote || "",
  };

  try {
    await db
      .insert(schema.siteSettings)
      .values({ settingKey: STORE_INVOICE_DETAILS_KEY, settingValue: value })
      .onConflictDoUpdate({
        target: schema.siteSettings.settingKey,
        set: { settingValue: value, updatedAt: new Date() },
      });
  } catch (error) {
    console.error("Failed to save invoice details", error);
    return { ok: false, message: "The invoice details could not be saved." };
  }

  await db.insert(schema.auditLogs).values({
    action: "store.invoice_details.update",
    targetType: "site_setting",
    targetId: null,
    metadata: { by: session.username, before, after: value },
  });

  revalidatePath("/admin/orders");
  return { ok: true, message: "Invoice details saved." };
}
