"use client";

import { useEffect, useState } from "react";

/**
 * Example Minecraft usernames for input placeholders.
 *
 * Placeholders must never use a real player's name — least of all a staff
 * member's. It reads as though the field is pre-filled with their account, and
 * it quietly publishes that person's handle on every screen the field appears on.
 *
 * Names here are invented and follow Minecraft's own rules (3–16 characters,
 * letters/digits/underscore) so the example is always a legal value.
 */
export const EXAMPLE_IGNS = [
  "NovaCrafter",
  "EmberFox_",
  "PixelWarden",
  "AshenPine",
  "CobaltDrift",
  "LumenStrike",
  "QuartzRaven",
  "VoidHarbour",
] as const;

/** Example creator display names, for the creator-code editor. */
export const EXAMPLE_CREATORS = [
  { name: "NovaPlays", handle: "novaplays" },
  { name: "EmberTV", handle: "embertv" },
  { name: "PixelPine", handle: "pixelpine" },
  { name: "DriftLive", handle: "driftlive" },
] as const;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/**
 * A random example, chosen after mount.
 *
 * The first render deliberately returns the same fixed entry on the server and
 * the client — randomising during render would produce different HTML on each
 * side and trip a hydration mismatch. The shuffle happens in an effect, which
 * only ever runs in the browser.
 */
export function useExampleIgn(): string {
  const [name, setName] = useState<string>(EXAMPLE_IGNS[0]);
  useEffect(() => {
    setName(pick(EXAMPLE_IGNS));
  }, []);
  return name;
}

export function useExampleCreator(): { name: string; handle: string } {
  const [creator, setCreator] = useState<{ name: string; handle: string }>(EXAMPLE_CREATORS[0]);
  useEffect(() => {
    setCreator(pick(EXAMPLE_CREATORS));
  }, []);
  return creator;
}
