import { createHash, randomInt } from "node:crypto";

/**
 * Pure helpers for two-step verification recovery codes, split from
 * recovery-codes.ts (server-only, database) so they can be tested.
 */

export const RECOVERY_CODE_COUNT = 10;

/** No 0/O, 1/I/L: codes are read off paper and typed back by hand. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUP = 5;

/** One code, `XXXXX-XXXXX`: 10 characters from a 31-letter alphabet, ~49 bits. */
export function generateRecoveryCode(): string {
  const chars = Array.from({ length: GROUP * 2 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, GROUP).join("")}-${chars.slice(GROUP).join("")}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

/** Case, spaces and dashes are forgiven when a code is typed back. */
export function normaliseRecoveryCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.length !== GROUP * 2) return null;
  for (const char of cleaned) if (!ALPHABET.includes(char)) return null;
  return cleaned;
}

/** Salted with the account id, so the same code on two accounts never hashes alike. */
export function hashRecoveryCode(userId: string, normalisedCode: string): string {
  return createHash("sha256").update(`${userId}:${normalisedCode}`, "utf8").digest("hex");
}
