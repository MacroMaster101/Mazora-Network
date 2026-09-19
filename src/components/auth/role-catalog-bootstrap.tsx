"use client";

import { setRoleCatalog, type RoleDef } from "@/lib/auth/role-catalog-core";

/**
 * Installs the server's role catalogue into the browser's registry.
 *
 * Runs during render (not in an effect) and is placed above everything that
 * shows a role, so the first client render already agrees with the server's
 * HTML. setRoleCatalog is idempotent, so re-rendering is harmless.
 *
 * Browser only. On the server the registry is shared process-wide (globalThis)
 * and already loaded by the layout; installing a render's snapshot there could
 * put back a role that a concurrent roles action had just removed.
 */
export function RoleCatalogBootstrap({ roles }: { roles: RoleDef[] }) {
  if (typeof window !== "undefined") setRoleCatalog(roles);
  return null;
}
