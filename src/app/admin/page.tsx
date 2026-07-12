import type { Metadata } from "next";
import { getPlayers } from "@/lib/data/players";
import { getStaff, getEvents } from "@/lib/data/content";
import { getServerStatus } from "@/lib/data/status";
import { DashHeader, StatTile } from "@/components/dashboard/dash-ui";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverview() {
  const [players, staff, events, status] = await Promise.all([getPlayers(), getStaff(), getEvents(), getServerStatus()]);
  const online = players.filter((p) => p.status === "online").length;
  const activeEvents = events.filter((e) => e.status !== "completed").length;

  const stats = [
    { label: "Website users", value: String(players.length + staff.length), detail: "demo dataset" },
    { label: "Minecraft players", value: String(players.length), detail: "registered" },
    { label: "Online now", value: status.live ? String(status.players) : String(online), detail: status.live ? "live" : "demo" },
    { label: "New this week", value: "12", detail: "signups" },
    { label: "Open tickets", value: "0", detail: "unassigned: 0" },
    { label: "Pending appeals", value: "0", detail: "awaiting review" },
    { label: "Pending reports", value: "0", detail: "player + bug" },
    { label: "Active events", value: String(activeEvents), detail: "upcoming + live" },
  ];

  const activity = [
    { who: "NovaCrafter", what: "reached level 96", when: "2026-07-11" },
    { who: "Aria", what: "published Summer Build Festival", when: "2026-07-04" },
    { who: "Kade", what: "shipped combat balance 1.8", when: "2026-06-29" },
    { who: "EnderVex", what: "won Spring Clash 2026", when: "2026-04-05" },
  ];

  return (
    <>
      <DashHeader title="Admin overview" subtitle="Network health and recent activity at a glance." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} detail={s.detail} />
        ))}
      </div>

      <section className="panel mt-6 p-6">
        <h2 className="font-display text-lg font-bold">Latest activity</h2>
        <ul className="mt-4 divide-y divide-line">
          {activity.map((a, i) => (
            <li key={i} className="flex items-center justify-between py-3 text-sm">
              <span>
                <span className="font-semibold">{a.who}</span> <span className="text-muted">{a.what}</span>
              </span>
              <span className="telemetry text-xs text-muted">{fmtDate(a.when)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Content management (create/edit/delete, role changes, moderation actions) is scaffolded read-only in this phase and
          activates with the database and audit logging.
        </p>
      </section>
    </>
  );
}
