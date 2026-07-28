import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock3, Home, ShieldCheck } from "lucide-react";
import { getLaunchGate } from "@/lib/launch";
import { site } from "@/lib/site";
import { DiscordIcon } from "@/components/shared/icon";

export const metadata: Metadata = {
  title: "Coming Soon",
  description: "This Mazora Network feature is being prepared for launch.",
  robots: { index: false, follow: false },
};

export default async function LaunchStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const from = (await searchParams).from ?? "/";
  const gate = getLaunchGate(from);
  const accountRoute = from.startsWith("/dashboard") || from.startsWith("/admin");

  return (
    <div className="launch-status-page">
      <div className="launch-status-card">
        <div className="launch-status-icon-wrap" aria-hidden="true">
          <Clock3 size={28} />
        </div>
        <div className="launch-status-content">
          <p className="launch-status-eyebrow">{gate?.eyebrow ?? "Feature update in progress"}</p>
          <h1 className="launch-status-title">{gate?.title ?? "This page is temporarily reserved."}</h1>
          <p className="launch-status-message">
            {gate?.message ?? "We are completing final checks before making this available to everyone."}
          </p>
          <div className="launch-status-badge"><ShieldCheck size={14} /> In final testing</div>
          <div className="launch-status-actions">
            <Link href={accountRoute ? "/dashboard" : "/"} className="btn btn-primary">
              {accountRoute ? <ArrowLeft size={16} /> : <Home size={16} />}
              {accountRoute ? "Back to dashboard" : "Back home"}
            </Link>
            <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-ghost">
              <DiscordIcon size={16} /> Get updates on Discord
            </a>
          </div>
          <p className="launch-status-note">No action is required. Existing accounts and progress are not affected.</p>
        </div>
      </div>
    </div>
  );
}
