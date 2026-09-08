/**
 * Optimistic like state for the gallery, kept pure so the undo can be tested.
 *
 * The grid flips the heart before the server has answered, which is the right
 * feel but means every rejection needs an exact undo. Two things made that go
 * wrong: the rollback reset the whole list to the server snapshot — throwing
 * away unrelated likes made since the page loaded — and it only touched the
 * grid, so the open lightbox kept showing a filled heart for a like the server
 * had refused. A guest saw "Liked Artwork" sitting under "Please log in to like
 * artworks."
 *
 * So the undo is not a re-toggle and not a refetch: it restores the exact
 * values captured before the click, for one item, wherever that item is held.
 * Re-toggling would be wrong at the clamp — a liked item showing 0 would come
 * back as 1.
 */

/**
 * The only fields a like touches.
 *
 * `hasLiked` is optional because a signed-out render omits it — the server has
 * no viewer to answer for. Absent and false mean the same thing to the heart,
 * but only one of them is what the server actually said, so a rollback puts
 * back whichever it was.
 */
export interface LikeState {
  hasLiked?: boolean;
  likesCount: number;
}

interface Identified {
  id: string;
}

function toggled<T extends LikeState>(item: T): T {
  const hasLiked = !item.hasLiked;
  return {
    ...item,
    hasLiked,
    // Matches the server's GREATEST(count - 1, 0). If the two clamp
    // differently the number visibly jumps when the page revalidates.
    likesCount: Math.max(0, item.likesCount + (hasLiked ? 1 : -1)),
  };
}

/** Flip the like on one item, leaving every other item untouched. */
export function withLikeToggled<T extends LikeState & Identified>(items: T[], id: string): T[] {
  return items.map((item) => (item.id === id ? toggled(item) : item));
}

/** Put one item's like state back to `previous` after the server refused it. */
export function withLikeRestored<T extends LikeState & Identified>(
  items: T[],
  id: string,
  previous: LikeState,
): T[] {
  return items.map((item) =>
    item.id === id
      ? { ...item, hasLiked: previous.hasLiked, likesCount: previous.likesCount }
      : item,
  );
}

/** The same flip for a single held item, such as the open lightbox. */
export function likeToggled<T extends LikeState>(item: T): T {
  return toggled(item);
}

/** The same restore for a single held item. */
export function likeRestored<T extends LikeState>(item: T, previous: LikeState): T {
  return { ...item, hasLiked: previous.hasLiked, likesCount: previous.likesCount };
}
