import { TOP_ROLE, hasAtLeast } from "@/lib/auth/roles";
import type { Role } from "@/lib/types";

/**
 * The stored permission set for one module, plus whether that module is
 * Web Dev-tier. Split out of `permissions.ts` so the decision can be tested: that
 * module imports "server-only" and cannot be reached from a test.
 */
export interface ModuleAccessInput {
  /**
   * True for modules an owner must NOT reach by rank alone. Only the top role
   * gets in automatically; everyone else, owners included, needs an explicit
   * grant in the module's own role or user list.
   */
  webDevOnly: boolean;
  configuredRoles: readonly Role[];
  configuredUserIds: readonly string[];
  userId?: string | null;
}

/**
 * Decide whether one role may manage one module.
 *
 * The owner short-circuit is deliberately narrow. It predates this function and
 * every ordinary module still depends on it, so it stays — but it must not
 * cover an Web Dev-tier module, or "Web Dev only" would mean nothing: the owner branch
 * fires before the configured role list is ever read, which is exactly why the
 * audit module's Web Dev-only default had no effect for so long.
 *
 * The top role is never gated. Locking TOP_ROLE out of a module would leave
 * nobody able to unlock it.
 */
export function canAccessModule(role: Role | null, input: ModuleAccessInput): boolean {
  if (!role) return false;
  if (role === TOP_ROLE) return true;
  if (!input.webDevOnly && hasAtLeast(role, "owner")) return true;
  if (input.configuredRoles.includes(role)) return true;
  return Boolean(input.userId && input.configuredUserIds.includes(input.userId));
}
