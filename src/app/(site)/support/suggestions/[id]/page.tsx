import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { getSuggestionThread } from "@/lib/data/suggestions-board";
import { publicPageMetadata } from "@/lib/seo";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { SuggestionsClosedNotice } from "@/components/suggestions/suggestions-closed-notice";
import { BackLink } from "@/components/shared";
import { ThreadView } from "@/components/suggestions/thread-view";

// Rendered per request, not prerendered: an unknown id must 404 for real
// (see the store product page for the full reasoning behind this pattern),
// and votes/replies/lock state change independently of any rebuild.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const thread = await getSuggestionThread(id);
  if (!thread) return { title: "Suggestion not found", robots: { index: false, follow: false } };

  return publicPageMetadata({
    title: thread.title,
    description: thread.description.slice(0, 160),
    path: `/support/suggestions/${id}`,
  });
}

export default async function SuggestionThreadPage({ params }: { params: Promise<{ id: string }> }) {
  // Runtime switch, independent of the compiled launchGates. An admin can
  // close the board from Site Settings without a deploy; posted ideas are
  // kept, just not served.
  const { suggestionsEnabled } = await getSiteGeneralSettings();
  if (!suggestionsEnabled) return <SuggestionsClosedNotice />;
  const { id } = await params;
  const [session, viewerId] = await Promise.all([getSession(), getSessionUserId()]);
  const thread = await getSuggestionThread(id, viewerId);
  if (!thread) notFound();

  const canModerate = viewerId ? await canManageSuggestions(session, viewerId) : false;
  const currentPath = `/support/suggestions/${id}`;

  return (
    <section className="section shell space-y-6">
      <BackLink href="/support/suggestions" label="Back to suggestions" />
      <ThreadView
        thread={thread}
        viewerId={viewerId}
        viewerRole={session?.role ?? null}
        isLoggedIn={Boolean(session)}
        canModerate={canModerate}
        loginHref={`/login?next=${encodeURIComponent(currentPath)}`}
      />
    </section>
  );
}
