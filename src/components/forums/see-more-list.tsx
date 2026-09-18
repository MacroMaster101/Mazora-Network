"use client";

import { Children, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Forums shown per category before "See more", on the board and in the admin alike. */
export const FORUMS_PREVIEW_LIMIT = 5;

/**
 * A list that shows its first few rows and folds the rest behind "See more".
 *
 * The rows are rendered by the caller (on the board, on the server), so only
 * the toggle is client-side. The toggle is a row of the same list, keeping a
 * `divide-y` border between it and the last visible row.
 *
 * `expandedClassName` is applied to the rows once expanded — the online panels
 * use it to cap the height and scroll, so a busy evening cannot stretch the
 * sidebar down the page.
 */
export function SeeMoreList({
  children,
  as = "div",
  className,
  toggleClassName = "px-5 py-3",
  expandedClassName,
  limit = FORUMS_PREVIEW_LIMIT,
  noun = ["forum", "forums"],
}: {
  children: ReactNode;
  as?: "div" | "ul";
  className?: string;
  toggleClassName?: string;
  expandedClassName?: string;
  limit?: number;
  noun?: [singular: string, plural: string];
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const hidden = items.length - limit;
  const List = as;
  const Row = as === "ul" ? "li" : "div";

  return (
    <>
      <List
        className={
          expanded && expandedClassName
            ? `${className ?? ""} ${expandedClassName}`
            : className
        }
      >
        {expanded ? items : items.slice(0, limit)}
        {hidden > 0 && !expandedClassName && toggle(Row)}
      </List>
      {hidden > 0 && expandedClassName && toggle("div")}
    </>
  );

  function toggle(Wrapper: "div" | "li") {
    return (
      <Wrapper className={toggleClassName}>
        <button
          type="button"
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-bright hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <>
              <ChevronUp size={15} aria-hidden="true" /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={15} aria-hidden="true" /> See {hidden} more{" "}
              {hidden === 1 ? noun[0] : noun[1]}
            </>
          )}
        </button>
      </Wrapper>
    );
  }
}
