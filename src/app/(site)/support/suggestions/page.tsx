import { publicPageMetadata } from "@/lib/seo";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { SuggestionsClosedNotice } from "@/components/suggestions/suggestions-closed-notice";
import { FloatingBrandLogo, PageHero } from "@/components/shared";
import { getSession, getSessionUserId } from "@/lib/auth";
import { listBoardSuggestions } from "@/lib/data/suggestions-board";
import { DEFAULT_SUGGESTION_SORT, SUGGESTION_SORTS, type SuggestionSort } from "@/lib/suggestions-rules";
import { getSupportCard } from "@/lib/data/support-settings";
import { BoardList } from "@/components/suggestions/board-list";
import { SUGGESTION_STATUSES } from "@/components/suggestions/suggestion-meta";
import { getSuggestionFormSettings } from "@/lib/data/suggestion-form-settings";

export const metadata = publicPageMetadata({
  title: "Suggestions Board",
  description: "Browse community feature suggestions, vote for your favorites, and join the discussion.",
  path: "/support/suggestions",
});

const SORT_SET: readonly string[] = SUGGESTION_SORTS;
const STATUS_SET: readonly string[] = SUGGESTION_STATUSES;

/** searchParams may arrive as a single value or (rarely, from a repeated
 *  query key) an array — either way only the first value is meaningful here. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `listBoardSuggestions` accepts arbitrary strings for `category`/`status` by
 * design (it just filters `WHERE category = $1`) — validating against the
 * known vocabularies is this page's job. An unrecognised value is dropped
 * rather than forwarded, so a stray/garbled query string shows the
 * unfiltered board instead of silently matching nothing.
 */
export default async function SuggestionsBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string | string[]; category?: string | string[]; status?: string | string[] }>;
}) {
  // Runtime switch, independent of the compiled launchGates. An admin can
  // close the board from Site Settings without a deploy; posted ideas are
  // kept, just not served.
  const { suggestionsEnabled } = await getSiteGeneralSettings();
  if (!suggestionsEnabled) return <SuggestionsClosedNotice />;

  const sp = await searchParams;

  const sortParam = firstValue(sp.sort);
  const sort: SuggestionSort = sortParam && SORT_SET.includes(sortParam) ? (sortParam as SuggestionSort) : DEFAULT_SUGGESTION_SORT;

  // Validate against the CONFIGURED categories, not a compile-time list, so a
  // renamed category filters correctly and a removed one is simply dropped.
  const formSettings = await getSuggestionFormSettings();
  const categoryParam = firstValue(sp.category);
  const category = categoryParam && formSettings.categories.includes(categoryParam) ? categoryParam : undefined;

  const statusParam = firstValue(sp.status);
  const status = statusParam && STATUS_SET.includes(statusParam) ? statusParam : undefined;

  const [session, viewerId, card] = await Promise.all([
    getSession(),
    getSessionUserId(),
    getSupportCard("suggestions"),
  ]);
  const page = card.page!;

  const suggestions = await listBoardSuggestions({ sort, category, status, viewerId });

  return (
    <>
      <PageHero backLink={{ href: "/support", label: "Back to Support" }} eyebrow={page.eyebrow} title={page.title} lead={page.lead} illustration={<FloatingBrandLogo />} />
      <section className="section shell">
        <BoardList suggestions={suggestions} sort={sort} category={category} status={status} isLoggedIn={Boolean(session)} form={formSettings} />
      </section>
    </>
  );
}
