import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { BUILTIN_ROLES, normalizeRoleKey, roleCatalog, setRoleCatalog, type RoleDef, type RoleKind } from "@/lib/auth/role-catalog-core";

/** How long one instance trusts its copy before re-reading the table. */
const CATALOG_TTL_MS = 30_000;

/**
 * Loader state, shared through globalThis rather than module variables.
 *
 * Next bundles server actions called from client components separately from
 * the pages that render them, so this file can be instantiated more than once
 * in one server process. With module-level state, a roles action refreshed
 * only its own copy and the Roles page kept showing a deleted role until its
 * copy's TTL ran out. One shared object means a refresh is seen everywhere.
 */
interface LoaderState {
  loadedAt: number;
  pending: Promise<void> | null;
  /** The last logged failure message on this instance, so an outage does not
   *  re-log the same error every CATALOG_TTL_MS forever. Reset on success. */
  lastLoggedFailure: string | null;
  /**
   * Where the active catalogue came from. "database" only after a successful,
   * valid load; "fallback" while the built-ins are standing in. A transient
   * failure after a good load keeps the last good database catalogue (and its
   * source), so one bad read never reshuffles who outranks whom.
   */
  source: "database" | "fallback";
}

const STATE_KEY = Symbol.for("mazora.roleCatalog.loader");
const shared = globalThis as { [STATE_KEY]?: LoaderState };
const state: LoaderState = (shared[STATE_KEY] ??= { loadedAt: 0, pending: null, lastLoggedFailure: null, source: "fallback" });

function fallBackToBuiltIns(): void {
  // Only fall back when no good database catalogue was ever loaded here.
  if (state.source === "database") return;
  setRoleCatalog(BUILTIN_ROLES);
}

async function load(): Promise<void> {
  const db = getDb();
  if (!db) {
    setRoleCatalog(BUILTIN_ROLES);
    state.source = "fallback";
    state.lastLoggedFailure = null;
    state.loadedAt = Date.now();
    return;
  }
  try {
    const rows = await db.select().from(schema.roles);
    const defs: RoleDef[] = rows.map((row) => ({
      // Transitional: a table seeded by 054 but not yet migrated by 055 still
      // holds the legacy top-role key. Removable once 055 has run.
      key: normalizeRoleKey(row.key),
      label: row.label,
      color: row.color,
      icon: row.icon,
      description: row.description,
      kind: row.kind as RoleKind,
      position: row.position,
      locked: row.locked,
      showOnTeam: row.showOnTeam,
    }));
    if (defs.length > 0 && setRoleCatalog(defs)) {
      state.source = "database";
    } else {
      // An empty table (migration not yet applied) or an invalid row set:
      // keep the last good catalogue, or the built-ins if there never was one.
      fallBackToBuiltIns();
    }
    state.lastLoggedFailure = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Only log when the failure differs from the last one logged on this
    // instance — otherwise a persistent outage (e.g. migration 054 not yet
    // applied) logs the same error every CATALOG_TTL_MS forever.
    if (message !== state.lastLoggedFailure) {
      console.error("Role catalogue could not be loaded; keeping the last good catalogue (built-ins if none)", error);
      state.lastLoggedFailure = message;
    }
    fallBackToBuiltIns();
  }
  state.loadedAt = Date.now();
}

/**
 * Whether the active catalogue came from a successful database load. Role
 * mutations refuse to run otherwise — positions computed from the built-in
 * stand-ins would overwrite the real ladder.
 */
export function roleCatalogIsLive(): boolean {
  return state.source === "database";
}

/** Make sure the registry is fresh (at most CATALOG_TTL_MS old). */
export async function ensureRoleCatalog(): Promise<void> {
  if (Date.now() - state.loadedAt < CATALOG_TTL_MS) return;
  state.pending ??= load().finally(() => {
    state.pending = null;
  });
  await state.pending;
}

/**
 * Re-read now — call after every roles mutation on this instance. A load
 * already in flight may have started before the mutation committed, so wait
 * for it and then load again rather than sharing its (possibly stale) result.
 */
export async function refreshRoleCatalog(): Promise<void> {
  while (state.pending) await state.pending.catch(() => undefined);
  state.loadedAt = 0;
  await ensureRoleCatalog();
}

/** The catalogue, highest rank first, freshly ensured. Safe to pass to the browser. */
export async function getRoleCatalogData(): Promise<RoleDef[]> {
  await ensureRoleCatalog();
  return [...roleCatalog()];
}

/** How many accounts hold each role, from auth app_metadata (not profiles.role). */
export async function roleHolderCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const db = getDb();
  if (!db) return counts;
  const rows = await db.execute(sql`
    select coalesce(raw_app_meta_data ->> 'role', 'member') as "role", count(*)::int as "count"
    from auth.users
    group by 1
  `);
  for (const row of rows as unknown as Array<{ role: string; count: number }>) {
    // Legacy keys (pre-055) fold into their current key. Removable once 055 has run.
    const key = normalizeRoleKey(row.role);
    counts.set(key, (counts.get(key) ?? 0) + Number(row.count));
  }
  return counts;
}
