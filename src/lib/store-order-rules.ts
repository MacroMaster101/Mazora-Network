/**
 * Rules shared by the checkout actions (actions/store.ts and the code preview
 * in actions/creator-codes.ts). Kept out of those files because every export
 * of a "use server" module becomes a browser-callable endpoint, and because
 * plain functions here can be tested without a database.
 */

/** Shown when the Site Settings "Storefront & Cart" switch is off. */
export const STORE_PAUSED = "Store checkout is paused right now. Please try again later.";

/** Most units of one product a single order may carry. */
export const MAX_QUANTITY_PER_PRODUCT = 20;

export interface CartLine {
  slug: string;
  qty: number;
}

/**
 * Folds repeated slugs into one line per product.
 *
 * The per-entry quantity ceiling means nothing if the same slug can be sent
 * twenty times over: 20 entries of 20 is 400 of one product. The ceiling is
 * applied to the merged figure, and a cart over it is refused (null) rather
 * than trimmed, the same answer a single entry over the ceiling already gets.
 * An order must never be recorded for a different quantity than was sent.
 */
export function mergeCartLines(lines: readonly CartLine[]): CartLine[] | null {
  const quantityBySlug = new Map<string, number>();
  for (const line of lines) {
    const merged = (quantityBySlug.get(line.slug) ?? 0) + line.qty;
    if (merged > MAX_QUANTITY_PER_PRODUCT) return null;
    quantityBySlug.set(line.slug, merged);
  }
  return Array.from(quantityBySlug, ([slug, qty]) => ({ slug, qty }));
}

/**
 * Neutralises Discord markdown so player-supplied text cannot restyle the
 * staff order embed or plant something clickable in it.
 *
 * Square brackets and parentheses are escaped because embeds render
 * `[label](https://…)` as a masked link: a note could show "View invoice" and
 * lead anywhere. `<` is escaped because `<@id>`, `<@&id>`, `<#id>` and
 * `<t:…>` render as mentions and timestamps inside an embed, which would let a
 * note imitate a staff or role mention. `#` stops a line turning into a
 * heading.
 *
 * A bare URL is deliberately left alone. Discord links it, but shows the real
 * address, so staff can see where it goes; that is the difference from a
 * masked link.
 */
export function escapeDiscordMarkdown(value: string): string {
  return value.replace(/[\\*_~`|>[\]()<#]/g, (match) => `\\${match}`);
}
