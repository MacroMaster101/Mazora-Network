/**
 * Turn a Discord role colour into chip styling.
 *
 * Discord stores a role colour as a 24-bit integer, with 0 meaning "no colour
 * set" rather than black.
 */

/** The role's colour as an [r, g, b] triple, or null when it has none. */
export function roleRgb(colour: unknown): [number, number, number] | null {
  if (typeof colour !== "number" || !Number.isInteger(colour)) return null;
  // 0 is "unset", not black, and anything outside 24 bits is malformed.
  if (colour <= 0 || colour > 0xffffff) return null;
  return [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff];
}

export interface RoleChipStyle {
  borderColor: string;
  backgroundColor: string;
}

/**
 * Border and tint for a role chip, or undefined to use the neutral default.
 *
 * Deliberately does not colour the text. Discord paints role names in their own
 * colour, but Discord only has to be legible on one dark background — this
 * panel renders in both themes, where a near-black role is unreadable in dark
 * and a pale one is unreadable in light. Carrying the colour on the border and
 * a faint fill identifies the role just as well and cannot fail either way.
 */
export function roleChipStyle(colour: unknown): RoleChipStyle | undefined {
  const rgb = roleRgb(colour);
  if (!rgb) return undefined;
  const [r, g, b] = rgb;
  return {
    borderColor: `rgb(${r} ${g} ${b} / 0.55)`,
    backgroundColor: `rgb(${r} ${g} ${b} / 0.14)`,
  };
}
