import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Activity,
  Bug,
  Gavel,
  Lightbulb,
  ScrollText,
  ShieldAlert,
  ShoppingBag,
  Ticket,
  UsersRound,
  Radio,
} from "lucide-react";
import { getSession, hasAtLeast, isStaff, roleLabel } from "@/lib/auth";
import { getServerStatus } from "@/lib/data/status";
import { getDiscordStats } from "@/lib/data/discord";
import { getPlayers } from "@/lib/data/players";
import { getEvents, getNews, getProducts } from "@/lib/data/content";
import { getAccountsSnapshot, getRecentAudit } from "@/lib/data/admin-overview";
import {
  Board,
  BoardNotice,
  Metric,
  StandbyQueue,
  WatchBar,
  ago,
  roleAccent,
} from "@/components/admin/control-room";

export const metadata: Metadata = { title: "Control room · Admin" };

const QUEUES = [
  { label: "Tickets", href: "/admin/tickets", icon: <Ticket size={15} /> },
  { label: "Appeals", href: "/admin/appeals", icon: <Gavel size={15} /> },
  { label: "Player reports", href: "/admin/reports", icon: <ShieldAlert size={15} /> },
  { label: "Bug reports", href: "/admin/bugs", icon: <Bug size={15} /> },
  { label: "Suggestions", href: "/admin/suggestions", icon: <Lightbulb size={15} /> },
];

export default async function ControlRoom() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.role)) redirect("/");

  const role = session.role;
  const showDiagnostics = role === "it";
  const canModerate = hasAtLeast(role, "moderator");
  const canManageContent = hasAtLeast(role, "administrator");
  const canSeeAccounts = hasAtLeast(role, "owner");
  const canSeeAudit = hasAtLeast(role, "it");

  const [status, discord, players, events, news, products, accounts, audit] = await Promise.all([
    getServerStatus(),
    getDiscordStats(),
    canModerate ? getPlayers() : Promise.resolve([]),
    canManageContent ? getEvents() : Promise.resolve([]),
    canManageContent ? getNews() : Promise.resolve([]),
    canManageContent ? getProducts() : Promise.resolve([]),
    canSeeAccounts ? getAccountsSnapshot() : Promise.resolve(null),
    canSeeAudit ? getRecentAudit() : Promise.resolve(null),
  ]);

  const onlinePlayers = players.filter((p) => p.status === "online").slice(0, 6);
  const liveEvents = events.filter((e) => e.status !== "completed").length;

  return (
    <div className="cr" style={{ "--ra": roleAccent(role) } as CSSProperties}>
      <WatchBar
        displayName={session.displayName}
        role={role}
        online={status.players}
        max={status.max}
        version={status.version}
        live={status.live}
      />

      {/* Network telemetry — the only figures on this page that are genuinely live. */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Players online"
          value={status.live ? String(status.players) : "—"}
          detail={status.live ? `of ${status.max} slots` : "status unavailable"}
          live={status.live}
        />
        <Metric
          label="Discord members"
          value={discord.live ? discord.members.toLocaleString() : "—"}
          detail={discord.live ? `${discord.online.toLocaleString()} online now` : "widget unavailable"}
          live={discord.live}
        />
        <Metric
          label="Java"
          value={status.live && status.java.online ? "Up" : "—"}
          detail={status.java.address}
          live={status.live && status.java.online}
        />
        <Metric
          label="Bedrock"
          value={status.live && status.bedrock.online ? "Up" : "—"}
          detail={`${status.bedrock.address} : ${status.bedrock.port}`}
          live={status.live && status.bedrock.online}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* Every staff rank sees their queues. Helpers see only this board, so it
            takes the full width rather than leaving an empty column beside it. */}
        <Board
          title="Your queues"
          icon={<Ticket size={13} />}
          tag={showDiagnostics ? "Standby" : "Coming soon"}
          className={!canModerate ? "xl:col-span-2" : undefined}
        >
          <StandbyQueue items={QUEUES} showDiagnostics={showDiagnostics} />
          <p className="border-t border-line px-4 py-3 text-xs text-muted">
            {showDiagnostics
              ? "Submissions are not stored yet. These open once the support tables are connected — until then the queues are empty by design, not because there is nothing waiting."
              : "These staff queues are coming soon. They will appear here as each workflow becomes available."}
          </p>
        </Board>

        {canModerate && (
          <Board
            title="Player roster"
            icon={<Radio size={13} />}
            href="/admin/players"
            linkLabel="All players"
            tag={onlinePlayers.length > 0 ? undefined : showDiagnostics ? "Standby" : "Coming soon"}
          >
            {onlinePlayers.length > 0 ? (
              <div>
                {onlinePlayers.map((p) => (
                  <div key={p.username} className="cr-row">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgb(var(--ra)/0.12)] text-xs font-bold text-[rgb(var(--ra))]">
                      {p.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.username}</span>
                      <span className="block text-xs text-muted">
                        {p.currentMode} · Level {p.level}
                      </span>
                    </span>
                    <span className="telemetry shrink-0 text-xs text-muted">{p.playtimeHours.toLocaleString()}h</span>
                  </div>
                ))}
              </div>
            ) : (
              <BoardNotice>
                {showDiagnostics
                  ? "Player profiles and statistics arrive with the Minecraft server integration."
                  : "The live player roster is coming soon."}
              </BoardNotice>
            )}
          </Board>
        )}

        {canSeeAccounts && (
          <Board
            title="Accounts"
            icon={<UsersRound size={13} />}
            href="/admin/users"
            linkLabel="Manage"
            tag="Live"
            /* The audit board sits beside this one; without it, take the row. */
            className={!canSeeAudit ? "xl:col-span-2" : undefined}
          >
            {accounts ? (
              <>
                <div className="grid grid-cols-3 gap-3 p-3">
                  <Metric label="Registered" value={accounts.total.toLocaleString()} live />
                  <Metric label="New · 7d" value={accounts.newThisWeek.toLocaleString()} live />
                  <Metric label="Staff" value={accounts.staffCount.toLocaleString()} live />
                </div>
                <div className="border-t border-line">
                  {accounts.recent.map((u) => (
                    <div key={u.email} className="cr-row">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{u.username}</span>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                      <span className="cr-tag shrink-0">{roleLabel(u.role)}</span>
                      <span className="telemetry w-9 shrink-0 text-right text-xs text-muted">{ago(u.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <BoardNotice>
                {showDiagnostics ? (
                  <>Account data needs <code className="text-ink">SUPABASE_SERVICE_ROLE_KEY</code> on the server.</>
                ) : (
                  "Account insights are temporarily unavailable."
                )}
              </BoardNotice>
            )}
          </Board>
        )}

        {canSeeAudit && (
          <Board title="Audit trail" icon={<ScrollText size={13} />} href="/admin/audit-logs" tag="Live">
            {audit === null ? (
              <BoardNotice>Not recording — no database connection.</BoardNotice>
            ) : audit.length === 0 ? (
              <BoardNotice>No privileged actions recorded yet.</BoardNotice>
            ) : (
              <div>
                {audit.map((row) => (
                  <div key={row.id} className="cr-row">
                    <span className="cr-tag shrink-0">{row.action}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">{row.actor}</span>
                      <span className="text-muted"> → {row.target}</span>
                      {row.detail && <span className="block text-xs text-muted">{row.detail}</span>}
                    </span>
                    <span className="telemetry w-9 shrink-0 text-right text-xs text-muted">{ago(row.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Board>
        )}

        {canManageContent && (
          <Board
            title="Content & commerce"
            icon={<ShoppingBag size={13} />}
            href="/admin/store"
            linkLabel="Manage"
            className="xl:col-span-2"
          >
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
              <Metric
                label="Store products"
                value={String(products.length)}
                detail={showDiagnostics ? "live in the database" : "available products"}
                live={products.length > 0}
              />
              <Metric
                label="Published news"
                value={news.length > 0 ? String(news.length) : "—"}
                detail={news.length > 0 ? "articles live" : "nothing published"}
                tag={news.length > 0 ? undefined : showDiagnostics ? "Standby" : "Coming soon"}
              />
              <Metric
                label="Active events"
                value={liveEvents > 0 ? String(liveEvents) : "—"}
                detail={events.length > 0 ? `${events.length} total` : "none scheduled"}
                tag={events.length > 0 ? undefined : showDiagnostics ? "Standby" : "Coming soon"}
              />
            </div>
          </Board>
        )}
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Activity size={13} /> {showDiagnostics
          ? "Bracketed figures are live. Anything marked “Standby” has no data source connected yet — it is blank because nothing is being recorded, not because the count is zero."
          : "Live figures update automatically. Tools marked “Coming soon” will appear as they become ready for staff."}
      </p>
    </div>
  );
}
