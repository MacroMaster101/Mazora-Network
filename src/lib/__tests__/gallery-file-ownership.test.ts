import assert from "node:assert/strict";
import test from "node:test";
import * as drizzle from "drizzle-orm";
import * as dbSchema from "@/lib/db/schema";
import * as imageRules from "@/lib/suggestion-image-rules";
import * as utils from "@/lib/utils";
import { isPublicBucketObjectUrl } from "@/lib/storage-url";
import { loadServerModule } from "./helpers/server-module";
import type * as Gallery from "@/lib/actions/gallery";
import type * as Deletion from "@/lib/data/account-deletion";

const PROJECT = "https://project.example.com";
const BUCKET = "news-images";
const objectUrl = (key: string) => `${PROJECT}/storage/v1/object/public/${BUCKET}/${key}`;

const ATTACKER = "00000000-0000-3000-8000-000000000001";
const VICTIM = "00000000-0000-3000-8000-000000000002";
const VICTIM_FILE = "gallery/submit-00000000-0000-4000-8000-0000000000aa.webp";
const ATTACKER_FILE = "gallery/submit-00000000-0000-4000-8000-0000000000bb.webp";

/* -------------------------------------------------------------- submission */

function submissionFixture() {
  const inserted: Array<Record<string, unknown>> = [];
  const copies: Array<{ url: string; keyBase: string }> = [];
  const gallery = loadServerModule<typeof Gallery>(new URL("../actions/gallery.ts", import.meta.url), {
    env: { NEXT_PUBLIC_SUPABASE_URL: PROJECT },
    globals: { File, atob },
    mocks: {
      "drizzle-orm": drizzle,
      "next/cache": { revalidatePath() {} },
      "@/lib/auth": {
        getSession: async () => ({ username: "Alex_Builder", displayName: "Alex_Builder", role: "member" }),
        getSessionUserId: async () => ATTACKER,
      },
      "@/lib/auth/permissions": {},
      "@/lib/audit-log": {},
      "@/lib/db/client": {
        schema: dbSchema,
        getDb: () => ({ insert: () => ({ values: async (row: Record<string, unknown>) => { inserted.push(row); } }) }),
      },
      "@/lib/news/image-store": {
        isOwnPublicImageUrl: (url: string) => isPublicBucketObjectUrl(url, PROJECT, BUCKET),
        copyOwnPublicImage: async (url: string, keyBase: string) => {
          copies.push({ url, keyBase });
          return { url: objectUrl(`${keyBase}.webp`), key: `${keyBase}.webp` };
        },
        rehostImageFromUrl: async () => null,
        storeImageBytes: async () => null,
      },
      "@/lib/rate-limit": { throttleAuthAction: async () => null },
      "@/lib/suggestion-image-rules": imageRules,
      "@/lib/utils": utils,
    },
  });
  return { gallery, inserted, copies };
}

test("a member linking to someone else's image in our bucket gets their own copy", async () => {
  const { gallery, inserted, copies } = submissionFixture();
  const form = new FormData();
  form.set("title", "Example build");
  form.set("imageUrl", objectUrl(VICTIM_FILE));

  const result = await gallery.submitGalleryAction(form);
  assert.equal(result.ok, true);
  assert.equal(copies.length, 1, "the linked file is copied");
  assert.equal(copies[0]!.url, objectUrl(VICTIM_FILE));
  assert.equal(inserted.length, 1);
  assert.notEqual(inserted[0]!.imageUrl, objectUrl(VICTIM_FILE), "the new row never points at the other member's file");
  assert.notEqual(inserted[0]!.thumbnailUrl, objectUrl(VICTIM_FILE));
  assert.match(String(inserted[0]!.imageUrl), /\/gallery\/submit-[0-9a-f-]{36}\.webp$/);
});

/* ---------------------------------------------------------------- deletion */

function deletionFixture(own: Array<{ imageUrl: string }>, others: Array<{ imageUrl: string }>) {
  const removed: string[][] = [];
  const reads = [
    own.map((row) => ({ ...row, thumbnailUrl: row.imageUrl })),
    others.map((row) => ({ ...row, thumbnailUrl: row.imageUrl })),
  ];
  const deletion = loadServerModule<typeof Deletion>(new URL("../data/account-deletion.ts", import.meta.url), {
    env: { NEXT_PUBLIC_SUPABASE_URL: PROJECT },
    mocks: {
      "drizzle-orm": drizzle,
      "@/lib/db/client": {
        schema: dbSchema,
        getDb: () => ({
          select: () => ({ from: () => ({ where: async () => reads.shift() ?? [] }) }),
          delete: () => ({ where: async () => undefined }),
        }),
      },
      "@/lib/data/orders": { anonymiseOrdersForUser: async () => true },
      "@/lib/news/image-store": { NEWS_IMAGE_BUCKET: BUCKET },
      "@/lib/storage/avatar-bucket": { AVATAR_BUCKET: "avatars" },
      "@/lib/supabase/admin": {
        getSupabaseAdmin: () => ({
          storage: {
            from: (bucket: string) => ({
              list: async () => ({ data: [], error: null }),
              remove: async (paths: string[]) => {
                if (bucket === BUCKET) removed.push(paths);
                return { error: null };
              },
            }),
          },
        }),
      },
    },
  });
  return { deletion, removed: () => removed.flat() };
}

test("deleting an account never removes a file another member's artwork still uses", async () => {
  // A pending row written before submissions were copied, pointing at the victim's file.
  const { deletion, removed } = deletionFixture(
    [{ imageUrl: objectUrl(VICTIM_FILE) }, { imageUrl: objectUrl(ATTACKER_FILE) }],
    [{ imageUrl: objectUrl(VICTIM_FILE) }],
  );
  const result = await deletion.cleanupAccountOwnedData(ATTACKER);
  assert.equal(result.ok, true);
  assert.deepEqual(removed(), [ATTACKER_FILE], "only the member's own, unshared file is removed");
});

test("a member's own files are still removed with their account", async () => {
  const { deletion, removed } = deletionFixture([{ imageUrl: objectUrl(ATTACKER_FILE) }], []);
  assert.equal((await deletion.cleanupAccountOwnedData(VICTIM)).ok, true);
  assert.deepEqual(removed(), [ATTACKER_FILE]);
});
