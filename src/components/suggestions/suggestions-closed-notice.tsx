import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { DiscordIcon } from "@/components/shared/icon";
import { site } from "@/lib/site";

/**
 * Shown in place of the board when an admin turns the Suggestions Board
 * setting off.
 *
 * This is deliberately NOT the `launchGates` mechanism. That one is a
 * pre-launch gate compiled into the code and enforced in middleware, so
 * changing it needs a deploy. This is a runtime switch an admin flips in Site
 * Settings. Keeping them separate means they compose rather than fight: if
 * either says the board is closed, it is closed, and neither has to know about
 * the other.
 *
 * Reuses the launch-status card styles so a member sees the same treatment
 * they would for any other not-yet-open feature.
 */
export function SuggestionsClosedNotice() {
  return (
    <div className="launch-status-page">
      <div className="launch-status-card">
        <div className="launch-status-content">
          <div className="launch-status-orbit" aria-hidden="true">
            <span className="launch-status-icon-wrap">
              <Sparkles size={28} />
            </span>
          </div>

          <p className="launch-status-eyebrow">Community launch</p>
          <h1 className="launch-status-title">Suggestions will open soon.</h1>
          <p className="launch-status-message">
            The board is closed while the team catches up. Ideas and replies already posted are
            safe — nothing has been deleted.
          </p>

          <span className="launch-status-badge">
            <ShieldCheck size={15} aria-hidden="true" /> Temporarily closed
          </span>

          <div className="launch-status-actions">
            <Link href="/support" className="btn btn-primary">
              <ArrowLeft size={16} aria-hidden="true" /> Back to Support
            </Link>
            <a href={site.discord} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <DiscordIcon size={16} /> Get updates on Discord
            </a>
          </div>

          <p className="launch-status-footnote">
            No action is required. Existing accounts and progress are not affected.
          </p>
        </div>
      </div>
    </div>
  );
}
