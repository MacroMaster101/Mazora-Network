import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, UserCog } from "lucide-react";
import { requireRole, roleLabel, canGrantRank, STAFF_ROLES } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { listStaffAccounts } from "@/lib/data/accounts";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ReadOnlyBanner } from "@/components/admin/admin-ui";
import { RankChip } from "@/components/admin/rank-chip";
import { InviteUserButton, PendingInvites } from "@/components/admin/user-invites";
import { UserAvatar } from "@/components/shared";
import { fmtDate } from "@/lib/utils";
import { StaffVisibilityToggle } from "@/components/admin/staff-visibility-toggle";

export const metadata: Metadata = { title: "Staff · Admin" };

/**
 * Highest rung first, so the page reads down the ladder.
 *
 * The team is derived from account ranks rather than a separate roster: the
 * previous page read a `getStaff()` stub that always returned an empty array,
 * so it showed "0 team members" while six people held staff ranks.
 */
const LADDER: Role[] = [...STAFF_ROLES].reverse();

export default async function AdminStaffPage() {
  const session = await requireRole("owner", "/admin/staff");
  const staff = await listStaffAccounts();

  // Someone who has not accepted yet is not on the team, so they are listed
  // separately rather than padding the rank groups with people who cannot log in.
  const pending = (staff ?? []).filter((account) => account.pendingInvite);
  const active = (staff ?? []).filter((account) => !account.pendingInvite);

  const byRank = LADDER.map((role) => ({
    role,
    members: active.filter((account) => account.role === role),
  })).filter((group) => group.members.length > 0);

  const total = active.length;

  // Uses the canonical grant rule, including IT appointing another IT.
  const assignable: Role[] = STAFF_ROLES.filter((role) => canGrantRank(session.role, role));

  return (
    <>
      <DashHeader
        title="Staff"
        subtitle={
          staff
            ? `${total} team member${total === 1 ? "" : "s"} across ${byRank.length} rank${byRank.length === 1 ? "" : "s"}`
            : "Team directory"
        }
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/admin/users" className="btn btn-ghost btn-sm">
              <UserCog size={15} /> Manage ranks
            </Link>
            <InviteUserButton assignable={assignable} />
          </span>
        }
      />

      {!staff && (
        <ReadOnlyBanner note="The team list requires SUPABASE_SERVICE_ROLE_KEY to be configured on the server." />
      )}

      {staff && (
        <PendingInvites
          invites={pending.map((account) => ({
            userId: account.userId,
            email: account.email,
            role: account.role,
            invitedAt: account.invitedAt,
          }))}
        />
      )}

      {staff && total === 0 ? (
        <div className="panel grid place-items-center gap-3 p-12 text-center">
          <ShieldCheck size={26} className="text-muted" />
          <p className="font-display text-lg font-bold">No one holds a staff rank yet</p>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            The team is built from account ranks. Promote someone to Helper or above and they appear here
            straight away — there is no separate list to maintain.
          </p>
          <Link href="/admin/users" className="btn btn-primary btn-sm mt-1">
            <UserCog size={15} /> Manage ranks
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {byRank.map((group) => (
            <section key={group.role} aria-labelledby={`rank-${group.role}`}>
              <div className="admin-editor-heading mb-3 flex items-center gap-3">
                <h2
                  id={`rank-${group.role}`}
                  className="font-display text-sm font-bold uppercase tracking-widest"
                >
                  {roleLabel(group.role)}
                </h2>
                <span className="telemetry text-xs text-muted">{group.members.length}</span>
                <span className="h-px flex-1 bg-line" aria-hidden="true" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.members.map((member) => (
                  <article key={member.userId} className="panel panel-hover flex items-center gap-3 p-4">
                    <UserAvatar username={member.username} avatarUrl={member.avatarUrl} size={40} />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate font-semibold">{member.username}</strong>
                      <span className="block truncate text-xs text-muted">{member.email}</span>
                      {member.lastSignInAt && (
                        <span className="mt-1 block text-[11px] text-muted">
                          Last seen {fmtDate(member.lastSignInAt)}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <RankChip role={member.role} />
                      {member.role === "it" ? (
                        <span className="telemetry text-xs text-muted">Internal</span>
                      ) : (
                        <StaffVisibilityToggle
                          userId={member.userId}
                          visible={member.publicStaffVisible}
                        />
                      )}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
