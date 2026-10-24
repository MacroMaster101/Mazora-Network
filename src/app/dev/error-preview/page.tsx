import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ErrorPreview, type PreviewView } from "./error-preview";

/**
 * Development only: every recovery screen in one place, so a design or copy
 * change can be checked without breaking a real page. Production answers 404,
 * so nothing here is reachable on the live site.
 */
export const metadata: Metadata = { title: "Error preview", robots: { index: false, follow: false } };

const VIEWS: PreviewView[] = ["error", "compact", "admin", "not-found", "global", "notice"];

export default async function ErrorPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  return <ErrorPreview views={VIEWS} view={VIEWS.find((item) => item === view) ?? "error"} />;
}
