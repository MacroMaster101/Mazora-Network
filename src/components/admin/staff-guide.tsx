"use client";

import { useId, useState, type ReactNode } from "react";
import { BadgePlus, Check, CircleUserRound, KeyRound, LayoutGrid, Lightbulb } from "lucide-react";
import Link from "@/components/ui/app-link";
import { RankChip } from "@/components/admin/rank-chip";
import { GuideDialog, GuidePausePill, guideStorage, useGuide } from "@/components/shared/guide-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { markStaffGuideSeen } from "@/lib/actions/staff-guide";
import { ADMIN_BOARD_DESCRIPTIONS, visibleAdminNav, type AdminNavAccess, type AdminNavGroup } from "@/lib/admin-nav";
import {
  STAFF_GUIDE_OPEN_EVENT,
  STAFF_GUIDE_STEPS,
  markStaffGuideSeenLocally,
  readStaffGuideBoardsLocally,
  staffGuideMode,
  type StaffGuideSeen,
} from "@/lib/staff-guide";
import type { Role } from "@/lib/types";

interface StaffGuideProps {
  role: Role;
  access: AdminNavAccess;
  seenBoards: StaffGuideSeen;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

/** Boards as links, grouped like the sidebar, each with its one-line description. */
function BoardList({ groups, onPick }: { groups: AdminNavGroup[]; onPick: () => void }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.heading} className="site-guide-group">
          <p className="site-guide-group-title">{group.heading}</p>
          {group.items.map((item) => (
            <Link key={item.href} href={item.href} onClick={onPick} className="site-guide-board">
              <item.icon size={16} aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <span>{ADMIN_BOARD_DESCRIPTIONS[item.href]}</span>
              </div>
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * Control-room guide for staff. Built from visibleAdminNav, so it lists exactly
 * the boards this member can open — custom roles and owner grants included.
 * First visit shows the full guide; when their boards later grow, the next
 * visit shows only the new ones. Reopened from the account menu inside /admin.
 */
export function StaffGuide({ role, access, seenBoards, username, displayName, avatarUrl }: StaffGuideProps) {
  const titleId = useId();
  const groups = visibleAdminNav(role, access);
  const boards = groups.flatMap((group) => group.items.map((item) => item.href));
  // Decided once per mount. Nothing renders until the guide opens, so reading
  // localStorage here cannot cause a hydration mismatch.
  const [autoMode] = useState(() =>
    staffGuideMode({ boards, seenOnServer: seenBoards, seenLocally: readStaffGuideBoardsLocally(guideStorage(), username) }),
  );
  const { open, step, setStep, openedBy, close, pause, pausedAt, resume } = useGuide({
    kind: "staff",
    username,
    stepCount: STAFF_GUIDE_STEPS.length,
    openEvent: STAFF_GUIDE_OPEN_EVENT,
    shouldAutoOpen: () => autoMode.kind !== "none",
    onDismiss: () => {
      markStaffGuideSeenLocally(guideStorage(), username, boards);
      void markStaffGuideSeen().catch(() => {});
    },
  });

  if (!open) {
    return pausedAt === null ? null : (
      <GuidePausePill
        label="Staff guide"
        step={pausedAt}
        stepCount={STAFF_GUIDE_STEPS.length}
        side="right"
        onResume={resume}
      />
    );
  }

  const reopenNote = (
    <p className="site-guide-note">
      <CircleUserRound size={14} aria-hidden="true" /> Reopen this guide anytime from Staff guide in your account menu.
    </p>
  );

  if (openedBy === "auto" && autoMode.kind === "new") {
    const fresh = new Set(autoMode.boards);
    const newGroups = groups
      .map((group) => ({ ...group, items: group.items.filter((item) => fresh.has(item.href)) }))
      .filter((group) => group.items.length > 0);
    return (
      <GuideDialog open eyebrow="Staff guide" titleId={titleId} step={0} stepCount={1} onStepChange={setStep} onClose={close}>
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><BadgePlus size={22} /></span>
          <h2 id={titleId} className="site-guide-title">New for you, {displayName}</h2>
          <p className="site-guide-text">New boards you can open:</p>
          <div className="site-guide-boards">
            <BoardList groups={newGroups} onPick={close} />
          </div>
          {reopenNote}
        </div>
      </GuideDialog>
    );
  }

  const managesAccess = groups
    .flatMap((group) => group.items)
    .filter((item) => item.href === "/admin/roles" || item.href === "/admin/permissions");

  let body: ReactNode;
  switch (STAFF_GUIDE_STEPS[step]) {
    case "welcome":
      body = (
        <div className="site-guide-welcome">
          <span className="site-guide-avatar">
            <UserAvatar username={username} avatarUrl={avatarUrl} size={76} rounded="rounded-[19px]" />
          </span>
          <h2 id={titleId} className="site-guide-title">
            Welcome to the Control room,{" "}<span className="site-guide-name">{displayName}</span>
          </h2>
          <div className="site-guide-actions"><RankChip role={role} /></div>
          <p className="site-guide-text">
            This is where staff run Mazora. What you can open depends on your rank and on any extra access an owner has
            given you. Here&apos;s a quick look at yours.
          </p>
        </div>
      );
      break;
    case "boards":
      body = (
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><LayoutGrid size={22} /></span>
          <h2 id={titleId} className="site-guide-title">Your boards</h2>
          <p className="site-guide-text">
            {boards.length === 1
              ? "You can open 1 board. Select it to jump straight there."
              : `You can open ${boards.length} boards. Pick one to jump straight there.`}
          </p>
          <div className="site-guide-boards">
            <BoardList groups={groups} onPick={pause} />
          </div>
        </div>
      );
      break;
    case "access":
      body = (
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><KeyRound size={22} /></span>
          <h2 id={titleId} className="site-guide-title">How access works</h2>
          {/* Worded for who is reading: people who manage access are told what
              they can do, everyone else who to ask. */}
          <ul className="site-guide-list">
            <li><Check size={15} aria-hidden="true" /> Each rank opens a set of boards; higher ranks see more.</li>
            {managesAccess.length > 0 ? (
              <li><Check size={15} aria-hidden="true" /> Extra boards can be granted to a role or a single person.</li>
            ) : (
              <>
                <li><Check size={15} aria-hidden="true" /> Owners can grant extra boards to a role or a single person.</li>
                <li><Check size={15} aria-hidden="true" /> A page you can&apos;t open names the rank it needs. Ask an owner.</li>
              </>
            )}
          </ul>
          {managesAccess.length > 0 && (
            <>
              <p className="site-guide-text site-guide-subhead">You manage access:</p>
              <div className="site-guide-actions">
                {managesAccess.map((item) => (
                  <Link key={item.href} href={item.href} onClick={pause} className="btn btn-ghost btn-sm">
                    <item.icon size={15} aria-hidden="true" /> {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      );
      break;
    case "tips":
      body = (
        <div className="site-guide-centered">
          <span className="site-guide-icon" aria-hidden="true"><Lightbulb size={22} /></span>
          <h2 id={titleId} className="site-guide-title">Good to know</h2>
          <ul className="site-guide-list">
            {/* Only for people who can open Audit Logs — for everyone else it's
                an internal detail they can't act on. */}
            {boards.includes("/admin/audit-logs") && (
              <li><Check size={15} aria-hidden="true" /> Staff changes are recorded in Audit Logs, where you can review them.</li>
            )}
            <li><Check size={15} aria-hidden="true" /> Your own orders, tickets and settings stay in My Dashboard.</li>
            <li><Check size={15} aria-hidden="true" /> Switch between the two from your account menu.</li>
          </ul>
          {reopenNote}
        </div>
      );
      break;
  }

  return (
    <GuideDialog
      open
      eyebrow="Staff guide"
      titleId={titleId}
      step={step}
      stepCount={STAFF_GUIDE_STEPS.length}
      onStepChange={setStep}
      onClose={close}
      onPause={pause}
    >
      {body}
    </GuideDialog>
  );
}
