import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Image as ImageIcon, Lightbulb, Lock, MessageCircle, SlidersHorizontal, ThumbsUp } from "lucide-react";
import type { BoardSuggestion } from "@/lib/data/suggestions-board";
import type { SuggestionSort } from "@/lib/suggestions-rules";
import { EmptyState, UserAvatar } from "@/components/shared";
import { cn, fmtDate, relative } from "@/lib/utils";
import { CategoryChip, SUGGESTION_STATUSES, StatusPill, statusLabel } from "./suggestion-meta";
import type { SuggestionFormSettings } from "@/lib/data/suggestion-form-settings";
import { NewSuggestionDialog } from "./new-suggestion-dialog";

type QueryState = { sort: SuggestionSort; category?: string; status?: string };

/** Builds a `/support/suggestions` link with `overrides` merged over the
 *  current filter state; an `undefined` override clears that param. */
function boardHref(base: QueryState, overrides: Partial<Record<keyof QueryState, string | undefined>>) {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
  if (merged.category) params.set("category", merged.category);
  if (merged.status) params.set("status", merged.status);
  const qs = params.toString();
  return qs ? `/support/suggestions?${qs}` : "/support/suggestions";
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "chip transition-colors",
        active && "border-accent bg-accent text-white shadow-sm shadow-accent/20",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Board index: sort/filter controls, the "new suggestion" entry point (a
 * login link for guests), and the suggestion list itself. Guests get the
 * exact same board — only the entry point and each card's vote/reply affordances
 * differ, and even those are just links, never hidden content.
 */
export function BoardList({
  suggestions,
  sort,
  category,
  status,
  isLoggedIn,
  form,
}: {
  suggestions: BoardSuggestion[];
  sort: SuggestionSort;
  category?: string;
  status?: string;
  isLoggedIn: boolean;
  /** Admin-configured categories and copy — drives both the filter row and
   *  the composer, so the two can never offer different choices. */
  form: SuggestionFormSettings;
}) {
  const base: QueryState = { sort, category, status };
  const loginHref = `/login?next=${encodeURIComponent("/support/suggestions")}`;
  const filtered = Boolean(category || status);

  return (
    <div className="space-y-6">
      <div className="glass p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Community ideas</p>
            <h2 className="mt-1 font-display text-2xl font-bold">See what players want next</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Browse ideas, open any conversation, and follow the feedback from other players.</p>
          </div>
          {isLoggedIn ? (
            <NewSuggestionDialog className="btn btn-primary shrink-0" form={form} />
          ) : (
            <Link href={loginHref} className="btn btn-primary shrink-0">Log in to suggest <ArrowRight size={15} /></Link>
          )}
        </div>

        {!isLoggedIn && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-3.5 text-sm">
            <Eye size={18} className="mt-0.5 shrink-0 text-accent-bright" />
            <p><strong className="text-ink">Everything here is public to read.</strong> <span className="text-muted">Sign in only when you want to vote, reply, or share your own idea.</span></p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card/95 p-3 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold uppercase tracking-wide text-muted">Show</span>
            <FilterLink href={boardHref(base, { sort: "newest" })} active={sort === "newest"}>
              Latest
            </FilterLink>
            <FilterLink href={boardHref(base, { sort: "top" })} active={sort === "top"}>
              Most supported
            </FilterLink>
        </div>

        <details className="group relative" open={filtered}>
          <summary className="btn btn-ghost btn-sm list-none gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-card [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal size={14} /> Filter ideas
            {filtered && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{Number(Boolean(category)) + Number(Boolean(status))}</span>}
          </summary>
          <div className="mt-2 w-full rounded-2xl border border-line-strong bg-card p-4 shadow-xl sm:absolute sm:right-0 sm:z-20 sm:w-[34rem]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Category</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <FilterLink href={boardHref(base, { category: undefined })} active={!category}>All</FilterLink>
                {form.categories.map((item) => <FilterLink key={item} href={boardHref(base, { category: item })} active={category === item}>{item}</FilterLink>)}
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Progress</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <FilterLink href={boardHref(base, { status: undefined })} active={!status}>All</FilterLink>
                {SUGGESTION_STATUSES.map((item) => <FilterLink key={item} href={boardHref(base, { status: item })} active={status === item}>{statusLabel(item)}</FilterLink>)}
              </div>
            </div>
            {filtered && <Link href="/support/suggestions" className="mt-4 inline-flex text-sm font-semibold text-accent-bright">Clear filters</Link>}
          </div>
        </details>
      </div>

      {suggestions.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={24} />}
          title="No suggestions yet"
          message={
            filtered
              ? "Nothing matches these filters yet. Try a different combination, or be the first to post."
              : "Be the first to share an idea for the network."
          }
          cta={isLoggedIn ? undefined : { label: "Log in to suggest", href: loginHref }}
        />
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <li key={s.id}>
              <Link href={`/support/suggestions/${s.id}`} className="panel panel-hover group grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <UserAvatar username={s.author.username} avatarUrl={s.author.avatarUrl} size={48} rounded="rounded-2xl" className="ring-2 ring-line" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><StatusPill status={s.status} /><CategoryChip category={s.category} />{s.locked && <span className="chip gap-1.5 text-warning"><Lock size={11} /> Locked</span>}</div>
                  <h3 className="mt-2 line-clamp-1 font-display text-lg font-bold transition group-hover:text-accent-bright">{s.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{s.description}</p>
                  <p className="mt-3 text-xs text-muted"><strong className="font-semibold text-ink">{s.author.displayName || s.author.username}</strong> <span className="opacity-70">@{s.author.username}</span> · <time dateTime={s.createdAt} title={fmtDate(s.createdAt)}>{relative(s.createdAt)}</time></p>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
                  <span className={cn("chip justify-center gap-1.5", s.hasVoted && "border-accent bg-accent/10 text-accent-bright")}><ThumbsUp size={13} /> {s.votesCount}</span>
                  <span className="chip justify-center gap-1.5"><MessageCircle size={13} /> {s.repliesCount}</span>
                  {s.imageCount > 0 && (
                    <span className="chip justify-center gap-1.5" title={`${s.imageCount} attached ${s.imageCount === 1 ? "image" : "images"}`}>
                      <ImageIcon size={13} /> {s.imageCount}
                    </span>
                  )}
                  <span className="hidden items-center justify-center gap-1 text-xs font-semibold text-accent-bright sm:flex">Open <ArrowRight size={12} /></span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
