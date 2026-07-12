import type { Metadata } from "next";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { MinecraftLinker } from "@/components/dashboard/minecraft-linker";

export const metadata: Metadata = { title: "Link Minecraft" };

export default function MinecraftPage() {
  return (
    <>
      <DashHeader title="Minecraft account" subtitle="Link your Minecraft account to sync stats, rewards and purchases." />
      <div className="max-w-2xl">
        <MinecraftLinker />
      </div>
    </>
  );
}
