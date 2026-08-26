import { z } from "zod";

export const STORE_PRODUCT_ACCENTS = ["green", "gold", "cyan", "rose", "violet", "orange"] as const;

export const storeProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a product name.").max(100),
  description: z.string().trim().min(5, "Add a short description.").max(1000),
  category: z.string().trim().min(1, "Choose a category.").max(60),
  price: z.coerce.number().min(0, "Price cannot be negative.").max(100000),
  salePrice: z.union([z.literal(""), z.coerce.number().min(0, "Sale price cannot be negative.").max(100000)]),
  imageUrl: z.string().trim().max(1000),
  features: z.string().max(3000),
  accent: z.enum(STORE_PRODUCT_ACCENTS),
  badge: z.string().trim().max(50),
  billing: z.enum(["", "Monthly", "Permanent"]),
  subcategory: z.string().trim().max(60),
  gameModeSlug: z.string().trim().min(1, "Choose a game mode.").max(100),
  sortOrder: z.coerce.number().int().min(-10000).max(10000),
  enabled: z.boolean(),
}).superRefine((value, context) => {
  if (value.salePrice !== "" && value.salePrice > value.price) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["salePrice"],
      message: "Sale price cannot be higher than the regular price.",
    });
  }
});

export type StoreProductInput = z.infer<typeof storeProductSchema>;

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function parseStoreProductForm(formData: FormData) {
  return storeProductSchema.safeParse({
    id: formText(formData, "id") || undefined,
    name: formText(formData, "name"),
    description: formText(formData, "description"),
    category: formText(formData, "category"),
    price: formText(formData, "price"),
    salePrice: formText(formData, "salePrice"),
    imageUrl: formText(formData, "imageUrl"),
    features: formText(formData, "features"),
    accent: formText(formData, "accent"),
    badge: formText(formData, "badge"),
    billing: formText(formData, "billing"),
    subcategory: formText(formData, "subcategory"),
    gameModeSlug: formText(formData, "gameModeSlug"),
    sortOrder: formText(formData, "sortOrder") || "0",
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
  });
}

export function storeProductSlug(value: StoreProductInput): string {
  return [value.gameModeSlug, value.category, value.subcategory || value.billing, value.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/g, "");
}

export function storeRankFamily(name: string): string {
  const family = name
    .replace(/\s*\((?:monthly|permanent)\)\s*$/i, "")
    .replace(/\s+(?:monthly|permanent)\s*$/i, "")
    .trim();
  return family || name.trim();
}
