import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageForums } from "@/lib/auth/permissions";
import { getForumBoard, getViewerActor } from "@/lib/data/forums";
import { getOnlineMembers, onlyStaff, withoutStaff } from "@/lib/data/presence";
import { BoardCategories } from "@/components/forums/board-categories";
import { CommunityActions } from "@/components/forums/community-actions";
import { canCreateTopic } from "@/lib/forums-rules";
import { OnlinePanels } from "@/components/forums/online-panels";
import { EmptyState, FloatingBrandLogo, PageHero } from "@/components/shared";
import { publicPageMetadata } from "@/lib/seo";

// The house helper, not a literal: it adds the OpenGraph and Twitter card data
// every other public page carries. The page this replaced used it too.
export const metadata: Metadata = publicPageMetadata({
  title: "Community Forums",
  description: "Discuss Mazora Network — announcements, game modes, events and general chat.",
  path: "/forums",
});

/*
  The online-staff panel reflects who was active in the last few minutes, so a
  cached board would show a stale roster. Both reads are cheap and the page is
  already dynamic for its counts.
*/
export const dynamic = "force-dynamic";

export default async function ForumsPage() {
  const [categories, online, actor, canCreateForums] = await Promise.all([
    getForumBoard(),
    getOnlineMembers(),
    getViewerActor(),
    viewerCanCreateForums(),
  ]);

  // Decided on the server; the client only uses it to choose what to render.
  // The actions re-check every rule themselves.
  const canPost = canCreateTopic({ locked: false }, actor);
  const openForums = categories.flatMap((category) =>
    category.forums
      .filter((forum) => !forum.locked)
      .map((forum) => ({ id: forum.id, name: forum.name, category: category.name })),
  );

  return (
    <>
      {/*
        The Support Center's "Discussion forum" card is how most people arrive
        here, so this page wears the same hero and back link as every other
        support destination rather than dropping visitors somewhere that looks
        unrelated to where they clicked from.
      */}
      <PageHero
        backLink={{ href: "/support", label: "Back to Support" }}
        eyebrow="Community discussion"
        title="The conversation continues here."
        lead="Ask questions, share builds, follow announcements and help shape what comes next across the network. Browse freely — posting needs an account."
        illustration={<FloatingBrandLogo />}
      />

      <section className="shell max-w-6xl pb-24 pt-5">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,17rem)]">
          <div className="min-w-0 space-y-5">
            <CommunityActions
              canPost={canPost}
              forums={openForums}
              // Only sent to viewers holding the permission; the action re-checks it.
              categories={canCreateForums ? categories.map(({ id, name }) => ({ id, name })) : []}
              canCreateForums={canCreateForums}
            />
            {categories.length === 0 ? (
              <EmptyState
                icon={<MessagesSquare size={22} />}
                title="The forums are being set up"
                message="No discussion areas have been published yet. Check back shortly."
              />
            ) : (
              <BoardCategories categories={categories} />
            )}
          </div>

          {/* Server-rendered first, then refreshed in place every half minute. */}
          <OnlinePanels initialStaff={onlyStaff(online)} initialMembers={withoutStaff(online)} />
        </div>
      </section>
    </>
  );
}

/** Whether the viewer holds the Community Forums permission (Admin → Permissions). Fails closed. */
async function viewerCanCreateForums(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) return false;
    return await canManageForums(session, await getSessionUserId());
  } catch {
    return false;
  }
}
