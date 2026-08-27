import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2, ShieldCheck, ArrowRight, UserCheck } from "lucide-react";
import { requireSession, getSessionUserId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { MinecraftAvatar } from "@/components/shared/minecraft-avatar";

export const metadata: Metadata = { title: "Minecraft Account" };

export default async function MinecraftPage() {
  await requireSession("/dashboard/minecraft");
  const userId = await getSessionUserId();

  let minecraftAccount: {
    username: string;
    uuid: string;
    linkedAt: string;
    skinUrl: string | null;
  } | null = null;

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
        minecraftAccount = {
          username: String(data.minecraft_username),
          uuid: String(data.minecraft_uuid),
          linkedAt: String(data.linked_at),
          skinUrl: data.skin_head_url ? String(data.skin_head_url) : null,
        };
      }
    }
  }

  return (
    <>
      <DashHeader
        title="Minecraft Identity"
        subtitle="Connect your Minecraft name (Java, Bedrock, TLauncher, or cracked) to display your skin and player stats."
      />
      <div className="max-w-3xl space-y-6">
        <section className="panel overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-bright">
              <Gamepad2 size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink">Minecraft Profile</span>
                {minecraftAccount ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success">
                    <UserCheck size={12} /> Linked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-bold text-muted">
                    Not Linked
                  </span>
                )}
              </div>

              {minecraftAccount ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line-strong bg-card/80 p-4">
                    <MinecraftAvatar
                      username={minecraftAccount.username}
                      skinUrl={minecraftAccount.skinUrl}
                      size={48}
                    />
                    <div>
                      <h3 className="font-display text-xl font-bold text-ink">{minecraftAccount.username}</h3>
                      <p className="text-xs text-muted font-medium mt-0.5">UUID: {minecraftAccount.uuid}</p>
                    </div>
                  </div>
                  <Link href="/dashboard/settings" className="btn btn-secondary btn-sm">
                    Manage in Settings <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="mt-3">
                  <h2 className="font-display text-lg font-bold text-ink">Link your Minecraft account</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
                    Connecting your Minecraft IGN unlocks your player 3D body skin, player directory listing, and in-game order delivery.
                  </p>
                  <Link href="/dashboard/settings" className="btn btn-primary btn-sm mt-4">
                    Set Minecraft Name in Settings <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line-strong bg-ink/5 p-4 text-xs text-muted">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent-bright" />
                <span>
                  Minecraft linking supports all client types including official Java, Bedrock (Geyser), and offline accounts.
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}