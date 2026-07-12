import type { Metadata } from "next";
import { getPlayers } from "@/lib/data/players";
import { getStaff } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { MinecraftAvatar, RoleBadge } from "@/components/shared";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Users · Admin" };

interface Row {
  username: string;
  role: string;
  rank: string;
  status: string;
  joined: string;
}

export default async function AdminUsersPage() {
  const [players, staff] = await Promise.all([getPlayers(), getStaff()]);
  const rows: Row[] = [
    ...staff.map((s) => ({ username: s.username, role: s.group.toLowerCase(), rank: "STAFF", status: s.status, joined: s.joinDate })),
    ...players.map((p) => ({ username: p.username, role: "member", rank: p.rank, status: p.status, joined: p.firstJoined })),
  ];

  const columns: Column<Row>[] = [
    {
      header: "User",
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <MinecraftAvatar username={r.username} size={30} />
          <span className="font-semibold">{r.username}</span>
        </span>
      ),
    },
    { header: "Role", cell: (r) => <span className="capitalize text-muted">{r.role}</span> },
    { header: "Rank", cell: (r) => <RoleBadge rank={r.rank} /> },
    {
      header: "Status",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className={r.status === "online" ? "dot" : "dot dot-off"} /> {r.status}
        </span>
      ),
    },
    { header: "Joined", align: "right", cell: (r) => <span className="telemetry text-muted">{fmtDate(r.joined)}</span> },
  ];

  return (
    <>
      <DashHeader title="Users" subtitle={`${rows.length} accounts`} />
      <ReadOnlyBanner note="Role changes, suspensions and account actions are permission-controlled and activate with the database." />
      <AdminTable columns={columns} rows={rows} />
    </>
  );
}
