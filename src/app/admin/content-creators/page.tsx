import type { Metadata } from "next";
import { ContentCreatorsManager } from "@/components/admin/content-creators-manager";
import { CONTENT_CREATORS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getContentCreators } from "@/lib/data/content-creators";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Content Creators · Admin" };

export default async function AdminContentCreatorsPage() {
  await requireModuleAccess(CONTENT_CREATORS_PERMISSION_KEY, "/admin/content-creators");
  const creators = await getContentCreators();
  return <ContentCreatorsManager creators={creators} />;
}
