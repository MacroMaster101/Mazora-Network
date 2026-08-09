import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home, ShieldCheck } from "lucide-react";
import { getLaunchGate } from "@/lib/launch";
import { site } from "@/lib/site";
import { DiscordIcon, Icon } from "@/components/shared/icon";

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
  const gateIcon = gate?.icon ?? "Clock3";
  
  const isSupportRoute = from.startsWith("/support") || from === "/forums" || from.includes("tickets");
  const isAccountRoute = (from.startsWith("/dashboard") || from.startsWith("/admin")) && !isSupportRoute;

  return (
    <div className="launch-status-page">
      <div className="launch-status-card">
        <div className="launch-status-content">
          <div className="launch-status-orbit" aria-hidden="true">
            <span className="launch-status-icon-wrap">
              <Icon name={gateIcon} size={31} />
            </span>
            <span className="launch-status-floating-icon is-one"><Icon name={gateIcon} size={13} /></span>
            <span className="launch-status-floating-icon is-two"><Icon name={gateIcon} size={12} /></span>
            <span className="launch-status-floating-icon is-three"><Icon name={gateIcon} size={11} /></span>
          </div>
          <p className="launch-status-eyebrow">{gate?.eyebrow ?? "Feature update in progress"}</p>
          <h1 className="launch-status-title">{gate?.title ?? "This page is temporarily reserved."}</h1>
          <p className="launch-status-message">
            {gate?.message ?? "We are completing final checks before making this available to everyone."}
          </p>
          <div className="launch-status-progress" aria-hidden="true">
            <span className="is-complete" />
            <span className="is-complete" />
            <span className="is-current" />
          </div>
          <div className="launch-status-badge"><ShieldCheck size={14} /> In final testing</div>
          <div className="launch-status-actions">
            {isSupportRoute ? (
              <Link href="/support" className="btn btn-primary">
                <ArrowLeft size={16} /> Back to Support
              </Link>
            ) : isAccountRoute ? (
              <Link href="/dashboard" className="btn btn-primary">
                <ArrowLeft size={16} /> Back to dashboard
              </Link>
            ) : (
              <Link href="/" className="btn btn-primary">
                <Home size={16} /> Back home
              </Link>
            )}

            {/* Secondary Back to Support button if on account/dashboard coming soon page */}
            {isAccountRoute && (
              <Link href="/support" className="btn btn-ghost">
                <ArrowLeft size={16} /> Back to Support
              </Link>
            )}

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
