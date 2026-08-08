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
import { getSession, hasAtLeast, isStaff } from "@/lib/auth";
import { getServerStatus } from "@/lib/data/status";
import { getDiscordStats } from "@/lib/data/discord";
import { getPlayers } from "@/lib/data/players";
import { getEvents, getNews, getProducts } from "@/lib/data/content";
import { getAccountsSnapshot, getRecentAudit } from "@/lib/data/admin-overview";
import { MinecraftAvatar, UserAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";
import {
  Board,
  BoardNotice,
  Metric,
  StandbyQueue,
  WatchBar,
  ago,
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
    <div className="space-y-6">
      <WatchBar
        username={session.username}
        displayName={session.displayName}
        avatarUrl={session.avatarUrl}
        role={role}
        online={status.players}
        max={status.max}
        version={status.version}
        live={status.live}
      />

      {/* Network telemetry — live upstream statistics. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Staff queues */}
        <Board
          title="Your queues"
          icon={<Ticket size={16} />}
          tag={showDiagnostics ? "Standby" : "Coming soon"}
          className={!canModerate ? "xl:col-span-2" : undefined}
        >
          <StandbyQueue items={QUEUES} showDiagnostics={showDiagnostics} />
          <p className="border-t border-line/60 px-5 py-3 text-xs text-muted font-medium bg-ink/5">
            {showDiagnostics
              ? "Submissions are not stored yet. These open once the support tables are connected — until then the queues are empty by design, not because there is nothing waiting."
              : "These staff queues are coming soon. They will appear here as each workflow becomes available."}
          </p>
        </Board>

        {canModerate && (
          <Board
            title="Player roster"
            icon={<Radio size={16} />}
            href="/admin/players"
            linkLabel="All players"
            tag={onlinePlayers.length > 0 ? undefined : showDiagnostics ? "Standby" : "Coming soon"}
          >
            {onlinePlayers.length > 0 ? (
              <div className="divide-y divide-line/40">
                {onlinePlayers.map((p) => (
                  <div key={p.username} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5 transition-colors">
                    <MinecraftAvatar username={p.username} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-ink">{p.username}</span>
                      <span className="block text-[11px] text-muted">
                        {p.currentMode} · Level {p.level}
                      </span>
                    </span>
                    <span className="telemetry shrink-0 text-xs text-muted font-medium">{p.playtimeHours.toLocaleString()}h</span>
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
            icon={<UsersRound size={16} />}
            href="/admin/users"
            linkLabel="Manage"
            tag="Live"
            className={!canSeeAudit ? "xl:col-span-2" : undefined}
          >
            {accounts ? (
              <>
                <div className="grid grid-cols-3 gap-3 p-4 bg-ink/5 dark:bg-surface/30">
                  <Metric label="Registered" value={accounts.total.toLocaleString()} live />
                  <Metric label="New · 7d" value={accounts.newThisWeek.toLocaleString()} live />
                  <Metric label="Staff" value={accounts.staffCount.toLocaleString()} live />
                </div>
                <div className="divide-y divide-line/40 border-t border-line/60">
                  {accounts.recent.map((u) => (
                    <div key={u.email} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5 transition-colors">
                      <UserAvatar username={u.username} avatarUrl={u.avatarUrl} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-ink">{u.username}</span>
                        <span className="block truncate text-[11px] text-muted">{u.email}</span>
                      </span>
                      <RankChip role={u.role} />
                      <span className="telemetry w-10 shrink-0 text-right text-xs text-muted font-medium">{ago(u.createdAt)}</span>
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
          <Board title="Audit trail" icon={<ScrollText size={16} />} href="/admin/audit-logs" tag="Live">
            {audit === null ? (
              <BoardNotice>Not recording — no database connection.</BoardNotice>
            ) : audit.length === 0 ? (
              <BoardNotice>No privileged actions recorded yet.</BoardNotice>
            ) : (
              <div className="divide-y divide-line/40">
                {audit.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5 transition-colors">
                    <span className="cr-tag shrink-0 uppercase tracking-wider text-[10px] font-bold">{row.action}</span>
                    <span className="min-w-0 flex-1 text-xs">
                      <span className="font-bold text-ink">{row.actor}</span>
                      <span className="text-muted"> → {row.target}</span>
                      {row.detail && <span className="block text-[11px] text-muted">{row.detail}</span>}
                    </span>
                    <span className="telemetry w-10 shrink-0 text-right text-xs text-muted font-medium">{ago(row.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Board>
        )}

        {canManageContent && (
          <Board
            title="Content & commerce"
            icon={<ShoppingBag size={16} />}
            href="/admin/store"
            linkLabel="Manage"
            className="xl:col-span-2"
          >
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 bg-ink/5 dark:bg-surface/30">
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

      <p className="mt-4 flex items-center gap-2 text-xs text-muted font-medium">
        <Activity size={14} className="text-accent-bright" />{" "}
        {showDiagnostics
          ? "Bracketed figures are live. Anything marked “Standby” has no data source connected yet — it is blank because nothing is being recorded, not because the count is zero."
          : "Live figures update automatically. Tools marked “Coming soon” will appear as they become ready for staff."}
      </p>
    </div>
  );
}
