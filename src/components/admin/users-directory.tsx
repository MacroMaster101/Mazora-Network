"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Gamepad2, Loader2, MailCheck, Search, Unlink, UserX } from "lucide-react";
import type { Role } from "@/lib/types";
import { RankChip, rankTier } from "@/components/admin/rank-chip";
import { RoleManager } from "@/components/admin/role-manager";
import { DeleteUserButton } from "@/components/admin/delete-user";
import { adminReleaseMinecraftUsernameAction, type AdminActionResult } from "@/lib/actions/user-admin";
import { MinecraftAvatar } from "@/components/shared";
import { Input, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface DirectoryRow {
  userId: string;
  username: string;
  /** Chosen display name, when it differs from the username. */
  displayName: string | null;
  email: string;
  role: Role;
  minecraftUsername?: string | null;
  /** Null when this row may be edited; otherwise why it may not be. */
  lockedReason: string | null;
  /** Invited but not yet accepted — cannot sign in, so it reads differently. */
  pendingInvite: boolean;
}

const initialAdminState: AdminActionResult = { ok: false, message: "" };

function ReleaseMinecraftButton({ userId, username, minecraftUsername }: { userId: string; username: string; minecraftUsername: string }) {
  const [state, formAction, pending] = useActionState(adminReleaseMinecraftUsernameAction, initialAdminState);
  const { toast } = useToast();

  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        title={`Release Minecraft IGN "${minecraftUsername}" claimed by @${username}`}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-ink/5 px-2 py-1 text-xs font-semibold text-muted transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
        {pending ? "Releasing…" : "Release IGN"}
      </button>
    </form>
  );
}

type Scope = "all" | "leadership" | "staff" | "supporter" | "player";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "leadership", label: "Leadership" },
  { key: "staff", label: "Staff" },
  { key: "supporter", label: "Supporters" },
  { key: "player", label: "Players" },
];

export function UsersDirectory({
  rows,
  assignable,
}: {
  rows: DirectoryRow[];
  assignable: Role[];
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const row of rows) {
      const tier = rankTier(row.role);
      map[tier] = (map[tier] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (scope !== "all" && rankTier(row.role) !== scope) return false;
      if (!needle) return true;
      return (
        row.username.toLowerCase().includes(needle) ||
        (row.displayName ?? "").toLowerCase().includes(needle) ||
        (row.minecraftUsername ?? "").toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle)
      );
    });
  }, [rows, scope, query]);

  return (
    <div className="space-y-5">
      <div className="panel space-y-4 p-4 sm:p-5">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by username, display name, Minecraft IGN or email"
            aria-label="Search accounts"
            className="pl-10"
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter accounts by tier"
        >
          {SCOPES.map((entry) => {
            const active = scope === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setScope(entry.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
                  active
                    ? "border-accent/60 bg-accent/20 text-accent-bright"
                    : "border-line bg-ink/5 text-muted hover:border-line-strong hover:bg-ink/10 hover:text-ink",
                )}
              >
                {entry.label}
                <span
                  className={cn(
                    "grid min-w-[1.4rem] place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none tabular-nums",
                    active
                      ? "bg-accent/30 text-accent-bright"
                      : "bg-ink/15 text-ink/80",
                  )}
                >
                  {counts[entry.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <p className="border-t border-line pt-3 text-sm text-muted">
          Showing <strong className="text-ink">{visible.length}</strong> of{" "}
          {rows.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="panel grid place-items-center gap-2 p-10 text-center">
          <UserX size={24} className="text-muted" />
          <p className="font-semibold">No accounts match</p>
          <p className="text-sm text-muted">
            Try a different tier or search term.
          </p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-muted">
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Minecraft IGN</th>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Change rank</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.userId}
                  className="border-b border-line/60 last:border-0 hover:bg-ink/[0.02]"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <MinecraftAvatar username={row.minecraftUsername || row.username} size={32} />
                      <span className="min-w-0">
                        <strong className="block truncate font-semibold">
                          {row.username}
                        </strong>
                        {row.displayName && (
                          <span className="block truncate text-xs text-ink/70">
                            {row.displayName}
                          </span>
                        )}
                        <span className="block truncate text-xs text-muted">
                          {row.email}
                        </span>
                        {row.pendingInvite && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                            <MailCheck size={11} aria-hidden="true" /> Invite
                            not accepted
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.minecraftUsername ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink">
                        <Gamepad2 size={13} className="text-accent-bright" />
                        {row.minecraftUsername}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">None linked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RankChip role={row.role} />
                  </td>
                  <td className="px-4 py-3">
                    {row.lockedReason ? (
                      <span className="text-xs text-muted">
                        {row.lockedReason}
                      </span>
                    ) : (
                      <RoleManager
                        userId={row.userId}
                        currentRole={row.role}
                        assignable={assignable}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {row.minecraftUsername && (
                        <ReleaseMinecraftButton
                          userId={row.userId}
                          username={row.username}
                          minecraftUsername={row.minecraftUsername}
                        />
                      )}
                      {row.lockedReason ? null : (
                        <DeleteUserButton
                          userId={row.userId}
                          username={row.username}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
