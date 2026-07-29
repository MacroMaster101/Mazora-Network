"use client";

import { useTransition } from "react";
import { Save } from "lucide-react";
import type { Role } from "@/lib/types";
import { roleLabel } from "@/lib/auth/roles";
import type { PermissionActionResult } from "@/lib/actions/permissions";
import { Textarea, useToast } from "@/components/ui";

export function PermissionsEditor({
  title,
  description,
  staffRoles,
  selected,
  locked,
  userIds,
  saveAction,
}: {
  title: string;
  description: string;
  staffRoles: Role[];
  selected: Role[];
  locked: Role[];
  userIds: string[];
  saveAction: (formData: FormData) => Promise<PermissionActionResult>;
}) {
  const [busy, start] = useTransition();
  const { toast } = useToast();

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await saveAction(fd);
          toast(res.message, res.ok ? "success" : "error");
        })
      }
      className="cr-board space-y-5 p-5"
    >
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description} Owner and IT are always included.</p>
        <p className="mt-1 text-sm text-muted">
          Each role below is granted on its own — ticking one role does not also grant any role above it. Tick every role you want to allow.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {staffRoles.map((role) => {
          const isLocked = locked.includes(role);
          return (
            <label
              key={role}
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm cursor-pointer hover:bg-ink/[0.02]"
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
              {isLocked && <span className="cr-tag ml-auto text-[0.65rem]">Always</span>}
            </label>
          );
        })}
      </div>

      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-widest text-muted">
          Individual users (one account id per line)
        </span>
        <Textarea name="userIds" rows={2} defaultValue={userIds.join("\n")} aria-label="Allowed user ids" />
      </label>

      <button type="submit" disabled={busy} className="btn btn-primary btn-sm flex items-center gap-2">
        <Save size={14} /> Save permissions
      </button>
    </form>
  );
}
