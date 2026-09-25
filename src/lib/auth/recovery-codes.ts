import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normaliseRecoveryCode,
} from "@/lib/auth/recovery-codes-core";

/**
 * Two-step verification recovery codes (migration 073). Supabase Auth has none
 * of its own, so they live here: hashed, single-use, shown in plain text only
 * at the moment they are created.
 *
 * Every function here fails soft and logs: a database problem must not break
 * the Settings page or leave a half-finished two-step setup throwing.
 */

/** Replace every code the account has with a fresh set, returned in plain text once. */
export async function issueRecoveryCodes(userId: string): Promise<string[] | null> {
  const db = getDb();
  if (!db) return null;
  const codes = generateRecoveryCodes();
  const rows = codes.map((code) => ({ userId, codeHash: hashRecoveryCode(userId, normaliseRecoveryCode(code)!) }));
  try {
    await db.transaction(async (tx) => {
      await tx.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, userId));
      await tx.insert(schema.mfaRecoveryCodes).values(rows);
    });
    return codes;
  } catch (error) {
    console.error("Recovery codes could not be issued:", error);
    return null;
  }
}

/** How many unused codes the account has left. */
export async function remainingRecoveryCodes(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const [row] = await db
      .select({ n: count() })
      .from(schema.mfaRecoveryCodes)
      .where(and(eq(schema.mfaRecoveryCodes.userId, userId), isNull(schema.mfaRecoveryCodes.usedAt)));
    return Number(row?.n ?? 0);
  } catch (error) {
    console.error("Recovery codes could not be counted:", error);
    return 0;
  }
}

/**
 * Spend one code. True only when it matched an unused code, which is marked
 * used in the same statement, so two requests racing with one code cannot
 * both succeed.
 */
export async function consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
  const db = getDb();
  const code = normaliseRecoveryCode(input);
  if (!db || !code) return false;
  try {
    const used = await db
      .update(schema.mfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.mfaRecoveryCodes.userId, userId),
          eq(schema.mfaRecoveryCodes.codeHash, hashRecoveryCode(userId, code)),
          isNull(schema.mfaRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: schema.mfaRecoveryCodes.id });
    return used.length > 0;
  } catch (error) {
    console.error("Recovery code could not be checked:", error);
    return false;
  }
}

export async function clearRecoveryCodes(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, userId));
  } catch (error) {
    console.error("Recovery codes could not be cleared:", error);
  }
}
