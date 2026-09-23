"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleCheck,
  CircleUserRound,
  Compass,
  Gamepad2,
  LayoutDashboard,
  LifeBuoy,
  Server,
  ShoppingBag,
} from "lucide-react";
import Link from "@/components/ui/app-link";
import { DiscordIcon } from "@/components/auth/provider-icons";
import { CopyIpButton } from "@/components/shared/copy-ip-button";
import { GuideDialog, GuidePausePill, guideStorage, useGuide } from "@/components/shared/guide-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getSiteGuideStatus, markSiteGuideSeen } from "@/lib/actions/site-guide";
import type { ServerAddresses } from "@/lib/data/site-settings";
import { site } from "@/lib/site";
import {
  SITE_GUIDE_OPEN_EVENT,
  SITE_GUIDE_STEPS,
  markSiteGuideSeenLocally,
  shouldAutoOpenSiteGuide,
  type SiteGuideStatus,
} from "@/lib/site-guide";

interface SiteGuideProps {
  autoOpen: boolean;
  username: string;
  displayName: string;
  avatarUrl?: string;
  addresses: ServerAddresses;
}

/**
 * Five-slide welcome guide for signed-in members. Opens by itself once per
 * account — after the splash and any unanswered cookie banner, so a newcomer is
 * never shown three things at once — and again whenever the account menu's
 * "Site guide" item asks. Any way of closing it counts as seen.
 */
export function SiteGuide({ autoOpen, username, displayName, avatarUrl, addresses }: SiteGuideProps) {
  const [status, setStatus] = useState<SiteGuideStatus | null>(null);
  const titleId = useId();
  const { open, step, setStep, close, pause, pausedAt, resume } = useGuide({
    kind: "site",
    username,
    stepCount: SITE_GUIDE_STEPS.length,
    openEvent: SITE_GUIDE_OPEN_EVENT,
    shouldAutoOpen: () => shouldAutoOpenSiteGuide({ seenOnServer: !autoOpen, username, storage: guideStorage() }),
    onDismiss: () => {
      markSiteGuideSeenLocally(guideStorage(), username);
      void markSiteGuideSeen().catch(() => {});
    },
  });

  // Refresh IGN / Discord state every time it opens: they may have just linked one.
  useEffect(() => {
    if (!open) return;
    let live = true;
    getSiteGuideStatus()
      .then((next) => { if (live) setStatus(next); })
      .catch(() => {});
    return () => { live = false; };
  }, [open]);

  if (!open) {
    return pausedAt === null ? null : (
      <GuidePausePill
        label="Site guide"
        step={pausedAt}
        stepCount={SITE_GUIDE_STEPS.length}
        side="left"
        onResume={resume}
      />
    );
  }

  const current = SITE_GUIDE_STEPS[step];
  let body: ReactNode;
  switch (current) {
    case "welcome":
      body = (
        <div className="site-guide-welcome">
          <span className="site-guide-avatar">
            <UserAvatar username={username} avatarUrl={avatarUrl} size={76} rounded="rounded-[19px]" />
          </span>
          <h2 id={titleId} className="site-guide-title">
            Welcome to {site.name},{" "}<span className="site-guide-name">{displayName}</span>
          </h2>
          <p className="site-guide-text">
            Your account is ready. This quick tour shows you how to set up your profile, join the server and find your
            way around. It takes about a minute.
          </p>
        </div>
      );
      break;
    case "ign":
      body = (
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><Gamepad2 size={22} /></span>
          <h2 id={titleId} className="site-guide-title">Set your Minecraft name</h2>
          <p className="site-guide-text">
            Add your in-game name (IGN) to your profile. Java, Bedrock and offline accounts all work.
          </p>
          <ul className="site-guide-list">
            <li><Check size={15} aria-hidden="true" /> Your skin on your profile and in the Players list</li>
            <li><Check size={15} aria-hidden="true" /> Store purchases delivered to you in-game</li>
            <li><Check size={15} aria-hidden="true" /> Your stats on the leaderboards</li>
          </ul>
          {status?.ign ? (
            <p className="site-guide-status"><CircleCheck size={16} aria-hidden="true" /> Linked as {status.ign}</p>
          ) : (
            <div className="site-guide-actions">
              <Link href="/dashboard/settings#mc-ign-input" onClick={pause} className="btn btn-primary">
                Set my IGN <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      );
      break;
    case "discord":
      body = (
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><DiscordIcon width={22} height={22} /></span>
          <h2 id={titleId} className="site-guide-title">Link your Discord</h2>
          <p className="site-guide-text">
            Connect Discord to get your community roles, announcements and faster help from staff.
          </p>
          {status?.discord ? (
            <p className="site-guide-status"><CircleCheck size={16} aria-hidden="true" /> Connected as {status.discord}</p>
          ) : (
            <div className="site-guide-actions">
              <Link href="/dashboard/settings" onClick={pause} className="btn btn-primary">
                Link Discord <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      );
      break;
    case "join":
      body = (
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><Server size={22} /></span>
          <h2 id={titleId} className="site-guide-title">Join the server</h2>
          <p className="site-guide-text">In Minecraft, open Multiplayer, choose Add Server and paste the address.</p>
          <div className="site-guide-addr">
            <span className="site-guide-addr-label">Java</span>
            <CopyIpButton ip={addresses.javaIp} variant="inline" />
          </div>
          <div className="site-guide-addr">
            <span className="site-guide-addr-label">Bedrock · port {addresses.bedrockPort}</span>
            <CopyIpButton ip={addresses.bedrockIp} variant="inline" />
          </div>
          <div className="site-guide-actions">
            <Link href="/play" onClick={pause} className="btn btn-ghost btn-sm">
              Full join guide <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      );
      break;
    case "explore":
      body = (
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><Compass size={22} /></span>
          <h2 id={titleId} className="site-guide-title">Find your way around</h2>
          <p className="site-guide-text">Everything else lives in the top menu. Here are the pages most players use.</p>
          <div className="site-guide-tiles">
            <Link href="/store" onClick={pause} className="site-guide-tile">
              <ShoppingBag size={18} aria-hidden="true" /><div><strong>Store</strong><span>Ranks and perks</span></div>
            </Link>
            <Link href="/events" onClick={pause} className="site-guide-tile">
              <CalendarDays size={18} aria-hidden="true" /><div><strong>Events</strong><span>What&apos;s on next</span></div>
            </Link>
            <Link href="/dashboard" onClick={pause} className="site-guide-tile">
              <LayoutDashboard size={18} aria-hidden="true" /><div><strong>Dashboard</strong><span>Orders and tickets</span></div>
            </Link>
            <Link href="/support" onClick={pause} className="site-guide-tile">
              <LifeBuoy size={18} aria-hidden="true" /><div><strong>Support</strong><span>Get help from staff</span></div>
            </Link>
          </div>
          <p className="site-guide-note">
            <CircleUserRound size={14} aria-hidden="true" /> Reopen this guide anytime from your account menu.
          </p>
        </div>
      );
      break;
  }

  return (
    <GuideDialog
      open={open}
      eyebrow="Site guide"
      titleId={titleId}
      step={step}
      stepCount={SITE_GUIDE_STEPS.length}
      onStepChange={setStep}
      onClose={close}
      onPause={pause}
    >
      {body}
    </GuideDialog>
  );
}
