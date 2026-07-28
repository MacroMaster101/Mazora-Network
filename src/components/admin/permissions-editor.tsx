"use client";

import { useTransition } from "react";
import { Save } from "lucide-react";
import type { Role } from "@/lib/types";
import { roleLabel } from "@/lib/auth/roles";
import { saveNewsPermissionsAction } from "@/lib/actions/permissions";
import { Textarea, useToast } from "@/components/ui";

export function PermissionsEditor({
  staffRoles,
  selected,
  locked,
  userIds,
}: {
  staffRoles: Role[];
  selected: Role[];
  locked: Role[];
  userIds: string[];
}) {
  const [busy, start] = useTransition();
  const { toast } = useToast();

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await saveNewsPermissionsAction(fd);
          toast(res.message, res.ok ? "success" : "error");
        })
      }
      className="cr-board space-y-5 p-5"
    >
      <div>
        <h2 className="font-display text-lg font-bold">Who can manage announcements</h2>
        <p className="mt-1 text-sm text-muted">
          These roles can import, edit, approve and publish news. Owner and IT are always
          included so this page cannot lock you out.
        </p>
        <p className="mt-1 text-sm text-muted">
          Each role below is granted on its own — ticking one role does not also grant any
          role above it. For example, ticking Moderator does not give Senior Moderator or
          Administrator access; tick every role you want to allow.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {staffRoles.map((role) => {
          const isLocked = locked.includes(role);
          return (
            <label
              key={role}
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm"
            >
              <input
                type="checkbox"
                name="roles"
                value={role}
                defaultChecked={isLocked || selected.includes(role)}
                disabled={isLocked}
                className="h-4 w-4 accent-[#8b5cf6]"
              />
              <span className="font-medium">{roleLabel(role)}</span>
              {isLocked && <span className="cr-tag ml-auto">Always</span>}
            </label>
          );
        })}
      </div>

      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">
          Individual users (one account id per line)
        </span>
        <Textarea name="userIds" rows={3} defaultValue={userIds.join("\n")} aria-label="Allowed user ids" />
      </label>

      <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
        <Save size={14} /> Save permissions
      </button>
    </form>
  );
}
