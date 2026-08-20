import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { requireSession, roleLabel, ROLES } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { ALL_ADMIN_NAV_ACCESS, buildAdminNav } from "@/lib/admin-nav";
import { RankChip } from "@/components/admin/rank-chip";

export const metadata: Metadata = { title: "No access · Admin" };

/**
 * Shown when a staff member opens an admin board above their rank.
 *
 * The old behaviour was a silent redirect back to the control room, which is
 * indistinguishable from a dead link — people reported that "nothing happens".
 * Naming the board, the rank it needs and the rank you hold turns a confusing
 * bounce into an answerable question: ask an owner, or stop clicking it.
 */

/** Resolves an admin path back to the label used in the sidebar. */
function boardLabel(path: string): string | null {
  const nav = buildAdminNav(ALL_ADMIN_NAV_ACCESS);
  for (const group of nav) {
    for (const item of group.items) {
      if (item.href === path) return item.label;
    }
  }
  return null;
}

function safeAdminPath(value: string | undefined): string | null {
  if (!value) return null;
  const normalised = value.replace(/[\t\r\n]/g, "").replace(/\\/g, "/");
  return normalised.startsWith("/admin/") && !normalised.startsWith("//") ? normalised : null;
}

function knownRole(value: string | undefined): Role | null {
  return value && ROLES.includes(value as Role) ? (value as Role) : null;
}

export default async function AdminNoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; need?: string }>;
}) {
  const session = await requireSession("/admin");
  const params = await searchParams;

  const from = safeAdminPath(params.from);
  const need = knownRole(params.need);
  const label = from ? boardLabel(from) : null;

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="panel w-full max-w-xl p-8 text-center sm:p-10">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
          <Lock size={22} aria-hidden="true" />
        </span>

        <h1 className="mt-5 font-display text-2xl font-bold">
          {label ? `You do not have access to ${label}` : "You do not have access to that board"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your account is signed in and working normally. This board is not assigned to your role or
          account, so it was not opened.
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-ink/5 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Your rank</dt>
            <dd className="mt-2">
              <RankChip role={session.role} />
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-ink/5 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Required access</dt>
            <dd className="mt-2">
              {need ? <RankChip role={need} /> : <span className="text-sm text-muted">Module permission</span>}
            </dd>
          </div>
        </dl>

        {need && (
          <p className="mt-5 text-xs leading-relaxed text-muted">
            An owner can raise your rank to {roleLabel(need)} from the Users board. Ranks are changed by
            people, never automatically.
          </p>
        )}

        <Link href="/admin" className="btn btn-primary mt-7">
          <ArrowLeft size={15} /> Back to the control room
        </Link>
      </div>
    </div>
  );
}
