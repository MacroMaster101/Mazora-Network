"use client";

import { useState, useTransition } from "react";
import type { Role } from "@/lib/types";
import { changeUserRole } from "@/lib/actions/roles";

const ASSIGNABLE_ORDER: Role[] = ["member", "vip", "helper", "moderator", "administrator", "owner", "it"];
const LABELS: Record<Role, string> = {
  guest: "Guest", member: "Member", vip: "VIP", helper: "Helper",
  moderator: "Moderator", administrator: "Admin", owner: "Owner", it: "IT",
};

export function RoleManager({
  userId,
  currentRole,
  assignable,
}: {
  userId: string;
  currentRole: Role;
  assignable: Role[];
}) {
  const [role, setRole] = useState<Role>(currentRole);
  const [msg, setMsg] = useState<string>("");
  const [pending, start] = useTransition();

  const options = ASSIGNABLE_ORDER.filter((r) => assignable.includes(r) || r === currentRole);

  function onSave() {
    start(async () => {
      const res = await changeUserRole({ userId, newRole: role });
      setMsg(res.message);
    });
  }

  return (
    <span className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        disabled={pending}
        className="rounded-md border border-line bg-surface px-2 py-1 text-sm"
      >
        {options.map((r) => (
          <option key={r} value={r}>{LABELS[r]}</option>
        ))}
      </select>
      <button
        onClick={onSave}
        disabled={pending || role === currentRole}
        className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
