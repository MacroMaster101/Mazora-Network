"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, ThumbsUp } from "lucide-react";
import { useToast } from "@/components/ui";
import { toggleSuggestionVoteAction } from "@/lib/actions/suggestions";
import { cn } from "@/lib/utils";

/**
 * Vote toggle for a single suggestion.
 *
 * Guests never see the interactive button — `isLoggedIn=false` renders a
 * login link instead, so there is nothing here for `canVote` to refuse.
 * `toggleSuggestionVoteAction` is the real source of truth: this button
 * updates optimistically and rolls back on `{ ok: false }`, but the count
 * shown after any full page refetch always comes from the server.
 */
export function VoteButton({
  suggestionId,
  votesCount,
  hasVoted,
  isLoggedIn,
  loginHref,
}: {
  suggestionId: string;
  votesCount: number;
  hasVoted: boolean;
  isLoggedIn: boolean;
  loginHref: string;
}) {
  const [count, setCount] = useState(votesCount);
  const [voted, setVoted] = useState(hasVoted);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!isLoggedIn) {
    return (
      <Link href={loginHref} className="btn btn-ghost btn-sm gap-1.5" title="Log in to vote">
        <ThumbsUp size={16} aria-hidden="true" />
        <span>{count}</span>
      </Link>
    );
  }

  function toggle() {
    const nextVoted = !voted;
    setVoted(nextVoted);
    setCount((c) => (nextVoted ? c + 1 : Math.max(0, c - 1)));

    startTransition(async () => {
      const result = await toggleSuggestionVoteAction({ suggestionId });
      if (!result.ok) {
        // Roll back the optimistic update; the toggle never happened server-side.
        setVoted(!nextVoted);
        setCount((c) => (nextVoted ? Math.max(0, c - 1) : c + 1));
        toast(result.message, "error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={voted}
      className={cn("btn btn-sm gap-1.5", voted ? "btn-primary" : "btn-ghost", pending && "opacity-70")}
    >
      {pending ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        // Filled once voted: the button also swaps to btn-primary, but the fill
        // is what reads as "liked" at a glance and matches the board card, which
        // uses the same ThumbsUp for a suggestion's vote count.
        <ThumbsUp size={16} aria-hidden="true" className={voted ? "fill-current" : undefined} />
      )}
      <span>{count}</span>
    </button>
  );
}
