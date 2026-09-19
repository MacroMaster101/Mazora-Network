"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "@/components/ui/app-link";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { useToast } from "@/components/ui";
import { nextVote, scoreAfter, type VoteValue } from "@/lib/comments/vote-rules";
import { cn } from "@/lib/utils";
import type { CommentAdapter } from "./types";

/**
 * ▲ score ▼. The change shows at once and rolls back if the server refuses
 * it; on success the server's totals replace the guess. Guests see the score
 * with arrows that lead to sign-in; anyone else who may not vote (the author,
 * a suspended account, a removed comment) sees the score alone.
 */
export function VoteControl({
  commentId,
  up,
  down,
  mine,
  canVote,
  loginHref,
  vote,
}: {
  commentId: string;
  up: number;
  down: number;
  mine: VoteValue;
  canVote: boolean;
  loginHref: string | null;
  vote: CommentAdapter["vote"];
}) {
  const [state, setState] = useState({ up, down, mine });
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const { toast } = useToast();

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Resync from fresh server props (e.g. after router.refresh()), but never
  // clobber an in-flight optimistic update with the stale props that raced it.
  useEffect(() => {
    if (!pendingRef.current) setState({ up, down, mine });
  }, [up, down, mine]);

  function click(direction: 1 | -1) {
    const previous = state;
    const to = nextVote(previous.mine, direction);
    setState({ ...scoreAfter(previous.up, previous.down, previous.mine, to), mine: to });
    startTransition(async () => {
      const result = await vote(commentId, to).catch(() => ({ ok: false, message: "Your vote could not be saved." }));
      if (!result.ok) {
        setState(previous);
        toast(result.message, "error");
        return;
      }
      if ("up" in result && typeof result.up === "number" && typeof result.down === "number") {
        setState({ up: result.up, down: result.down, mine: result.mine ?? to });
      }
    });
  }

  /*
    Up and down are counted separately, side by side, rather than collapsed into
    one net score: "2 up, 1 down" and "1 up, 0 down" are different conversations
    and a single "1" hides which one happened.
  */
  const pill = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition disabled:opacity-50";
  const tally = "text-xs font-bold tabular-nums";

  if (!canVote) {
    const label = `${state.up} ${state.up === 1 ? "upvote" : "upvotes"}, ${state.down} ${state.down === 1 ? "downvote" : "downvotes"}`;
    if (!loginHref) {
      return (
        <span className="inline-flex items-center gap-1 px-1 text-muted" aria-label={label}>
          <ArrowBigUp size={16} aria-hidden="true" />
          <span className={tally}>{state.up}</span>
          <ArrowBigDown size={16} className="ml-1" aria-hidden="true" />
          <span className={tally}>{state.down}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5">
        <Link href={loginHref} className={cn(pill, "text-muted hover:bg-ink/[0.06]")} aria-label={`Sign in to upvote — ${state.up} so far`}>
          <ArrowBigUp size={16} aria-hidden="true" />
          <span className={tally}>{state.up}</span>
        </Link>
        <Link href={loginHref} className={cn(pill, "text-muted hover:bg-ink/[0.06]")} aria-label={`Sign in to downvote — ${state.down} so far`}>
          <ArrowBigDown size={16} aria-hidden="true" />
          <span className={tally}>{state.down}</span>
        </Link>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-pressed={state.mine === 1}
        aria-label={`Upvote — ${state.up} ${state.up === 1 ? "upvote" : "upvotes"}`}
        onClick={() => click(1)}
        className={cn(pill, state.mine === 1 ? "bg-orange-500/10 text-orange-500" : "text-muted hover:bg-ink/[0.06] hover:text-orange-500")}
      >
        <ArrowBigUp size={16} fill={state.mine === 1 ? "currentColor" : "none"} aria-hidden="true" />
        <span className={tally}>{state.up}</span>
      </button>
      <button
        type="button"
        disabled={pending}
        aria-pressed={state.mine === -1}
        aria-label={`Downvote — ${state.down} ${state.down === 1 ? "downvote" : "downvotes"}`}
        onClick={() => click(-1)}
        className={cn(pill, state.mine === -1 ? "bg-sky-500/10 text-sky-500" : "text-muted hover:bg-ink/[0.06] hover:text-sky-500")}
      >
        <ArrowBigDown size={16} fill={state.mine === -1 ? "currentColor" : "none"} aria-hidden="true" />
        <span className={tally}>{state.down}</span>
      </button>
    </span>
  );
}
