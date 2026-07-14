import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock3, Home, MessagesSquare, ShieldCheck } from "lucide-react";
import { getLaunchGate } from "@/lib/launch";
import { site } from "@/lib/site";

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
  const { from = "/" } = await searchParams;
  const gate = getLaunchGate(from);
  const accountRoute = from.startsWith("/dashboard");

  return (
    <section className="launch-status-page shell">
      <div className="launch-status-card">
        <div className="launch-status-glow" aria-hidden="true" />
        <div className="launch-status-content">
          <span className="launch-status-icon"><Clock3 size={28} /></span>
          <p className="eyebrow">{gate?.eyebrow ?? "Mazora launch"}</p>
          <h1>{gate?.title ?? "This feature is coming soon."}</h1>
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
              <MessagesSquare size={16} /> Get updates on Discord
            </a>
          </div>
          <p className="launch-status-note">No action is required. Existing accounts and progress are not affected.</p>
        </div>
      </div>
    </section>
  );
}
