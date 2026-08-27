import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Receipt, Gamepad2, Shield, Calendar, ArrowRight } from "lucide-react";
import { requireSession, getSessionUserId } from "@/lib/auth";
import { roleLabel } from "@/lib/auth/roles";
import { getOrdersForUser } from "@/lib/data/orders";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DashHeader, StatTile } from "@/components/dashboard/dash-ui";
import { usd } from "@/lib/utils";

export const metadata: Metadata = { title: "Player Statistics" };

export default async function StatisticsPage() {
  const session = await requireSession("/dashboard/statistics");
  const userId = await getSessionUserId();

  const orders = userId ? await getOrdersForUser(userId) : [];

  let minecraftUsername: string | null = null;
  let linkedAt: string | null = null;

  if (userId && isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const accountStore = getSupabaseAdmin() ?? supabase;
    if (accountStore) {
      const { data } = await accountStore
        .from("minecraft_accounts")
        .select("minecraft_username, linked_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.minecraft_username) {
        minecraftUsername = String(data.minecraft_username);
        linkedAt = data.linked_at ? new Date(String(data.linked_at)).toLocaleDateString() : null;
      }
    }
  }

  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <>
      <DashHeader
        title="Player Statistics & Telemetry"
        subtitle="Live account telemetry, gameplay overview, and network engagement."
      />

      <div className="space-y-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatTile
            label="Minecraft IGN"
            value={minecraftUsername ?? "Unlinked"}
            detail={minecraftUsername ? "Linked character" : "Set in Settings"}
          />
          <StatTile
            label="Account Rank"
            value={roleLabel(session.role)}
            detail="Current network tier"
          />
          <StatTile
            label="Total Orders"
            value={String(orders.length)}
            detail={orders.length > 0 ? `Invested: ${usd(totalSpent)}` : "No purchases"}
          />
          <StatTile
            label="Account Status"
            value="Active"
            detail="Good standing"
          />
        </div>

        {/* Breakdown Card */}
        <section className="panel p-6 sm:p-7 space-y-6">
          <h2 className="font-display text-lg font-bold text-ink">Account Telemetry Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-line-strong bg-card/80 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-bright">
                  <Gamepad2 size={20} />
                </span>
                <div>
                  <span className="text-xs text-muted font-medium">In-Game Identity</span>
                  <p className="font-bold text-sm text-ink">{minecraftUsername ? `@${minecraftUsername}` : "Not linked"}</p>
                </div>
              </div>
              {linkedAt && <p className="mt-2 text-[11px] text-muted">Linked since {linkedAt}</p>}
            </div>

            <div className="rounded-xl border border-line-strong bg-card/80 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                  <Receipt size={20} />
                </span>
                <div>
                  <span className="text-xs text-muted font-medium">Store Transactions</span>
                  <p className="font-bold text-sm text-ink">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted">Total value: {usd(totalSpent)}</p>
            </div>

            <div className="rounded-xl border border-line-strong bg-card/80 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Shield size={20} />
                </span>
                <div>
                  <span className="text-xs text-muted font-medium">Security & Role</span>
                  <p className="font-bold text-sm text-ink">{roleLabel(session.role)}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted">Protected with session encryption</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line-strong">
            <span className="text-xs text-muted">Need to update your in-game identity or linked accounts?</span>
            <Link href="/dashboard/settings" className="btn btn-secondary btn-sm">
              Account Settings <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}