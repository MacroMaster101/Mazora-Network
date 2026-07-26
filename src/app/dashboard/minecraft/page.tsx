import type { Metadata } from "next";
import { Clock3, Gamepad2, ShieldCheck } from "lucide-react";
import { DashHeader } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Minecraft Linking · Coming Soon" };

export default function MinecraftPage() {
  return (
    <>
      <DashHeader title="Minecraft account" subtitle="Secure account linking is being prepared for a future release." />
      <div className="max-w-3xl">
        <section className="panel overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-bright"><Gamepad2 size={28} /></span>
            <div className="min-w-0">
              <span className="chip"><Clock3 size={13} /> Coming soon</span>
              <h2 className="mt-4 font-display text-2xl font-bold">Minecraft linking is not available yet</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">We have paused account linking while the server integration and security review are completed. You do not need to generate a code or run any in-game command.</p>
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-line-strong bg-ink/5 p-4 text-sm text-muted">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent-bright" />
                <span>We will announce the feature when both the website and Minecraft server are ready.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}