"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, CONTENT_CREATORS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { rehostImageFromUrl, storeImageBytes } from "@/lib/news/image-store";
import { isSupabaseStorageObjectUrl } from "@/lib/storage-url";
import { SOCIAL_PLATFORM_KEYS, isValidSocialUrl, type SocialPlatform } from "@/lib/creator-socials";
import { cleanAndUnwrapImageUrl } from "@/lib/utils";
import { resolveYouTubeProfileImage } from "@/lib/youtube-profile";
import type { CreatorSocial } from "@/lib/creator-socials";

export interface ContentCreatorActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

async function requireCreatorEditor() {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  return session && (await canManageModule(CONTENT_CREATORS_PERMISSION_KEY, session, userId))
    ? { session, userId }
    : null;
}

const creatorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Enter a creator name.").max(80),
  profileImageUrl: z
    .string()
    .trim()
    .max(2000, "The profile image link is too long."),
  bio: z.string().trim().max(180, "Keep the public intro under 180 characters."),
  socials: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORM_KEYS as [SocialPlatform, ...SocialPlatform[]]),
        url: z.string().trim().max(300).refine(isValidSocialUrl, "Enter a full http(s) link."),
      }),
    )
    .max(SOCIAL_PLATFORM_KEYS.length, "Too many social links."),
  publicVisible: z.boolean(),
  featuredOnHome: z.boolean(),
});

async function resolveCreatorImage(
  formData: FormData,
  creatorId: string,
  socials: CreatorSocial[],
): Promise<{ url: string | null; error?: string }> {
  const file = formData.get("profileImageFile");
  const rawLink = cleanAndUnwrapImageUrl(String(formData.get("profileImageUrl") ?? "").trim());
  const keyBase = `content-creators/${creatorId}-${Date.now()}`;

  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) {
      return { url: null, error: "Use a PNG, JPG, WebP, or GIF under 8 MB." };
    }
    const stored = await storeImageBytes(new Uint8Array(await file.arrayBuffer()), keyBase);
    if (!stored) return { url: null, error: "That upload is not a supported image." };
    return { url: stored.url };
  }

  if (!rawLink) {
    const youtube = socials.find((social) => social.platform === "youtube");
    if (!youtube) return { url: null };
    const youtubeAvatar = await resolveYouTubeProfileImage(youtube.url);
    if (!youtubeAvatar) return { url: null };
    const stored = await rehostImageFromUrl(youtubeAvatar, keyBase);
    return { url: stored?.url ?? youtubeAvatar };
  }
  if (rawLink.startsWith("/images/") && !rawLink.includes("..")) return { url: rawLink };
  if (isSupabaseStorageObjectUrl(rawLink, process.env.NEXT_PUBLIC_SUPABASE_URL)) return { url: rawLink };

  const stored = await rehostImageFromUrl(rawLink, keyBase);
  if (!stored) {
    return { url: null, error: "That image link could not be downloaded. Try a direct image URL or upload the file." };
  }
  return { url: stored.url };
}

export async function saveContentCreator(
  _previous: ContentCreatorActionResult,
  formData: FormData,
): Promise<ContentCreatorActionResult> {
  const editor = await requireCreatorEditor();
  if (!editor) return { ok: false, message: "You do not have permission to manage content creators." };

  let socials: unknown = [];
  try {
    socials = JSON.parse(String(formData.get("socials") ?? "[]"));
  } catch {
    return { ok: false, message: "The submitted links could not be read." };
  }

  const parsed = creatorSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    profileImageUrl: formData.get("profileImageUrl") || "",
    bio: formData.get("bio") || "",
    socials,
    publicVisible: formData.get("publicVisible") === "true",
    featuredOnHome: formData.get("featuredOnHome") === "true",
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
  const creatorId = parsed.data.id ?? randomUUID();
  const image = await resolveCreatorImage(formData, creatorId, parsed.data.socials);
  if (image.error) return { ok: false, errors: { profileImageUrl: image.error } };
  const values = {
    name: parsed.data.name,
    profileImageUrl: image.url,
    bio: parsed.data.bio || null,
    socials: parsed.data.socials,
    publicVisible: parsed.data.publicVisible,
    featuredOnHome: parsed.data.publicVisible && parsed.data.featuredOnHome,
    updatedAt: new Date(),
  };

  try {
    await db.transaction(async (tx) => {
      const id = parsed.data.id
        ? (await tx
            .update(schema.contentCreators)
            .set(values)
            .where(eq(schema.contentCreators.id, parsed.data.id))
            .returning({ id: schema.contentCreators.id }))[0]?.id
        : (await tx
            .insert(schema.contentCreators)
            .values({ ...values, id: creatorId, createdBy: editor.userId })
            .returning({ id: schema.contentCreators.id }))[0]?.id;
      if (!id) throw new Error("Content creator write returned no row.");
      await tx.insert(schema.auditLogs).values({
        action: "content_creator.save",
        targetType: "content_creator",
        targetId: id,
        metadata: { name: parsed.data.name, by: editor.session.username },
      });
    });
  } catch (error) {
    console.error("Failed to save content creator:", error);
    return { ok: false, message: "The creator could not be saved." };
  }

  revalidatePath("/admin/content-creators");
  revalidatePath("/");
  revalidatePath("/support/content-creator");
  return { ok: true, message: `Saved ${parsed.data.name}.` };
}

export async function deleteContentCreator(
  _previous: ContentCreatorActionResult,
  formData: FormData,
): Promise<ContentCreatorActionResult> {
  const editor = await requireCreatorEditor();
  if (!editor) return { ok: false, message: "You do not have permission to manage content creators." };
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "That creator could not be identified." };
  const db = getDb();
  if (!db) return { ok: false, message: "No database is configured." };
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ name: schema.contentCreators.name })
        .from(schema.contentCreators)
        .where(eq(schema.contentCreators.id, id))
        .limit(1);
      if (!existing) throw new Error("Content creator not found.");
      await tx.delete(schema.contentCreators).where(eq(schema.contentCreators.id, id));
      await tx.insert(schema.auditLogs).values({
        action: "content_creator.delete",
        targetType: "content_creator",
        targetId: id,
        metadata: { name: existing.name, by: editor.session.username },
      });
    });
  } catch (error) {
    console.error("Failed to delete content creator:", error);
    return { ok: false, message: "The creator could not be deleted." };
  }
  revalidatePath("/admin/content-creators");
  revalidatePath("/");
  revalidatePath("/support/content-creator");
  return { ok: true, message: "Content creator deleted." };
}
