import type { Metadata } from "next";
import { Vote } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Voting History" };

export default function VotesPage() {
  return (
    <>
      <DashHeader title="Voting history" subtitle="Your votes, streaks and rewards." />
      <DashEmpty
        icon={<Vote size={24} />}
        title="No votes tracked yet"
        message="Vote for the server to start a streak and earn rewards. History syncs to your linked Minecraft account."
        cta={{ label: "Vote now", href: "/vote" }}
      />
    </>
  );
}
