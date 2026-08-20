import "server-only";

import { redirect } from "next/navigation";
import { getSession, getSessionUserId } from "@/lib/auth";
import { isStaff } from "@/lib/auth/roles";
import { canManageModule } from "@/lib/auth/permissions";
import type { Session } from "@/lib/auth";

/** Enforce the same configurable module permission used by admin navigation. */
export async function requireModuleAccess(key: string, path: string): Promise<Session> {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;

  if (session && (await canManageModule(key, session, userId))) return session;

  if (session && isStaff(session.role)) {
    const params = new URLSearchParams({ from: path });
    redirect(`/admin/no-access?${params}`);
  }

  redirect("/");
}
