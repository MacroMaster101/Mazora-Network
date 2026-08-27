import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Receipt, Shield, ArrowRight, ShoppingBag, ExternalLink } from "lucide-react";
import { requireSession, isStaff, getSessionUserId } from "@/lib/auth";
import { roleLabel } from "@/lib/auth/roles";
import { getOrdersForUser } from "@/lib/data/orders";
import { countUnreadNotifications } from "@/lib/notifications-auto";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { StatTile } from "@/components/dashboard/dash-ui";
import { UserAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";
import { OrderCard } from "@/components/shared/order-card";
import { usd } from "@/lib/utils";

export const metadata: Metadata = { title: "User Dashboard" };

export default async function DashboardOverview() {
  const session = await requireSession("/dashboard");
  const staff = isStaff(session.role);
  const userId = await getSessionUserId();

  const orders = userId ? await getOrdersForUser(userId) : [];
  const unreadNotifications = userId ? await countUnreadNotifications(userId) : 0;

  let minecraftUsername: string | null = null;
  if (userId && isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const accountStore = getSupabaseAdmin() ?? supabase;
    if (accountStore) {
      const { data } = await accountStore
        .from("minecraft_accounts")
        .select("minecraft_username, minecraft_uuid, linked_at, skin_head_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.minecraft_username) {
        minecraftUsername = String(data.minecraft_username);
      }
    }
  }

  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      {/* Staff shortcut banner */}
      {staff && (
        <div className="rounded-2xl border border-purple-500/25 bg-card/95 dark:bg-card/85 p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 shadow-sm">
              <Shield size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-ink">Staff Access Authorized</span>
                <RankChip role={session.role} />
              </div>
              <p className="text-xs text-muted font-medium mt-0.5">
                You are viewing your personal account. Manage staff queues and network administration in the Control Room.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 dark:bg-accent-bright dark:hover:bg-accent-bright/90 px-4 py-2 text-xs font-bold text-white shadow-md transition-all"
          >
            Control Room <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Profile Welcome Banner */}
      <div className="rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-6 backdrop-blur-xl shadow-lg flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <UserAvatar username={session.username} avatarUrl={session.avatarUrl} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <RankChip role={session.role} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-bright flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-bright animate-pulse" />
                Active Account
              </span>
            </div>
            <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl text-ink">
              Welcome back, {session.displayName || session.username}
            </h1>
            <p className="mt-1 text-xs text-muted font-medium">
              Here is your account overview, activity stats, and quick links.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-ink/5 dark:bg-white/5 px-4 py-2.5 text-xs font-bold text-ink hover:border-accent/40 hover:text-accent-bright transition-all"
        >
          Account Settings
        </Link>
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label="Minecraft IGN"
          value={minecraftUsername ?? "Unlinked"}
          detail={minecraftUsername ? "Linked & verified" : "Set in Settings"}
        />
        <StatTile
          label="Account Rank"
          value={roleLabel(session.role)}
          detail={session.role === "member" ? "Standard player" : "Active rank perks"}
        />
        <StatTile
          label="Store Orders"
          value={String(orders.length)}
          detail={orders.length > 0 ? `Total: ${usd(totalSpent)}` : "No orders placed"}
        />
        <StatTile
          label="Account Status"
          value="Active"
          detail="Verified identity"
        />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/purchases"
          className="group rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-5 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40 hover:shadow-xl"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright group-hover:scale-105 transition-transform">
              <Receipt size={20} />
            </span>
            <div>
              <div className="telemetry text-2xl font-black text-ink">{orders.length}</div>
              <div className="text-xs font-bold text-ink group-hover:text-accent-bright transition-colors">
                Recent Purchases
              </div>
              <div className="text-[11px] text-muted font-medium mt-0.5">
                {orders.length > 0 ? `Latest: ${orders[0].reference}` : "View store history"}
              </div>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/notifications"
          className="group rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-5 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40 hover:shadow-xl"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright group-hover:scale-105 transition-transform">
              <Bell size={20} />
            </span>
            <div>
              <div className="telemetry text-2xl font-black text-ink">{unreadNotifications}</div>
              <div className="text-xs font-bold text-ink group-hover:text-accent-bright transition-colors">
                Notifications
              </div>
              <div className="text-[11px] text-muted font-medium mt-0.5">
                {unreadNotifications > 0
                  ? `${unreadNotifications} unread alert${unreadNotifications === 1 ? "" : "s"}`
                  : "View alerts & dispatches"}
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Orders Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-white drop-shadow-sm">Order History</h2>
            <p className="text-xs text-purple-200/90 font-medium">Your recent purchases and order requests</p>
          </div>
          {orders.length > 0 && (
            <Link
              href="/dashboard/purchases"
              className="text-xs font-bold text-accent-bright hover:underline inline-flex items-center gap-1 bg-[#160d28]/80 px-3 py-1.5 rounded-xl border border-accent/30 text-white shadow-sm"
            >
              View all ({orders.length}) <ExternalLink size={12} />
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-6 text-center backdrop-blur-xl shadow-lg">
            <ShoppingBag size={28} className="mx-auto text-muted/60" />
            <h3 className="mt-2 text-sm font-bold text-ink">No store orders yet</h3>
            <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
              Explore rank upgrades, crate keys, and cosmetic perks in the Mazora store.
            </p>
            <Link href="/store" className="btn btn-primary btn-sm mt-4">
              Browse the store
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 3).map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
