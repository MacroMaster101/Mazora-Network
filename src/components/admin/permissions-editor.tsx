"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Save, Search, ChevronDown, X, Shield, Lock, Check } from "lucide-react";
import type { Role } from "@/lib/types";
import { roleLabel } from "@/lib/auth/roles";
import type { PermissionActionResult } from "@/lib/actions/permissions";
import type { AccountSummary } from "@/lib/data/accounts";
import { MinecraftAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PermissionModuleConfig {
  id: string;
  category: "Content" | "Community" | "Commerce" | "System" | "Support";
  title: string;
  description: string;
  selected: Role[];
  userIds: string[];
  saveAction: (formData: FormData) => Promise<PermissionActionResult>;
  /**
   * Roles that cannot be unticked for THIS module. Defaults to the manager's
   * global set. An IT-tier module overrides it, because owner is not always
   * included there and showing it locked-on would be a lie.
   */
  locked?: Role[];
}

/**
 * Only what the picker renders or searches.
 *
 * This used to take the full `AccountSummary`, so every account's `createdAt`,
 * `lastSignInAt`, `invitedAt`, `publicStaffVisible`, `minecraftSkinUrl` and
 * `avatarUrl` were serialised into the RSC payload of an owner-gated page and
 * readable in view-source, despite none of them being displayed.
 * `lastSignInAt` in particular is a behavioural signal for every member.
 */
export type PermissionAccount = Pick<
  AccountSummary,
  "userId" | "username" | "displayName" | "email" | "role"
>;

export function PermissionsEditor({
  title,
  description,
  staffRoles,
  selected,
  locked,
  userIds: initialUserIds,
  allAccounts = [],
  saveAction,
}: {
  title: string;
  description: string;
  staffRoles: Role[];
  selected: Role[];
  locked: Role[];
  userIds: string[];
  allAccounts?: PermissionAccount[];
  saveAction: (formData: FormData) => Promise<PermissionActionResult>;
}) {
  const [busy, start] = useTransition();
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(initialUserIds);
  const [userQuery, setUserQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const accountsMap = useMemo(() => {
    const map = new Map<string, PermissionAccount>();
    for (const acc of allAccounts) {
      map.set(acc.userId, acc);
    }
    return map;
  }, [allAccounts]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return allAccounts;
    return allAccounts.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName?.toLowerCase().includes(q) ?? false) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [allAccounts, userQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddUser = (userId: string) => {
    if (!assignedUserIds.includes(userId)) {
      setAssignedUserIds((prev) => [...prev, userId]);
      setUserQuery("");
      setUserDropdownOpen(false);
    } else {
      toast("This user is already added to individual permissions.", "error");
    }
  };

  const handleRemoveUser = (id: string) => {
    setAssignedUserIds((prev) => prev.filter((item) => item !== id));
  };

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await saveAction(fd);
          toast(res.message, res.ok ? "success" : "error");
        })
      }
      className="panel space-y-5 p-5 sm:p-6"
    >
      <div>
        <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
          <Shield className="text-accent-bright" size={18} />
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {description}{" "}
          <span className="font-medium text-ink/70">
            {locked.map((role) => roleLabel(role)).join(" and ")}{" "}
            {locked.length === 1 ? "is" : "are"} always included.
          </span>
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
          Allowed Staff Roles
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {staffRoles.map((role) => {
            const isLocked = locked.includes(role);
            return (
              <label
                key={role}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold cursor-pointer transition",
                  isLocked
                    ? "border-line-strong bg-ink/10 text-muted cursor-not-allowed"
                    : "border-line bg-card hover:border-accent/40 hover:bg-accent/5 text-ink",
                )}
              >
                <input
                  type="checkbox"
                  name="roles"
                  value={role}
                  defaultChecked={isLocked || selected.includes(role)}
                  disabled={isLocked}
                  className="h-4 w-4 rounded accent-[#8b5cf6]"
                />
                <span className="font-semibold">{roleLabel(role)}</span>
                {isLocked && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-line-strong bg-ink/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    <Lock size={10} /> Always
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="border-t border-line/60 pt-4 space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted">
          Select Individual Users
        </label>

        {/* Assigned Users Badges */}
        {assignedUserIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {assignedUserIds.map((id) => {
              const account = accountsMap.get(id);
              const username = account ? account.username : id;
              const displayName = account?.displayName || username;

              return (
                <div
                  key={id}
                  className="flex items-center gap-2.5 rounded-xl border border-line-strong bg-white dark:bg-surface/80 px-3 py-1.5 shadow-sm text-xs"
                >
                  <MinecraftAvatar username={username} size={24} />
                  <div className="min-w-0">
                    <span className="font-bold text-ink truncate max-w-[140px] block">{displayName}</span>
                    <span className="text-[10px] text-muted truncate max-w-[140px] block">@{username}</span>
                  </div>
                  {account && <RankChip role={account.role} />}
                  <button
                    type="button"
                    onClick={() => handleRemoveUser(id)}
                    className="p-1 rounded-lg hover:bg-danger/15 text-muted hover:text-danger transition-colors shrink-0"
                    title="Remove user permission"
                  >
                    <X size={14} />
                  </button>
                  <input type="hidden" name="userIds" value={id} />
                </div>
              );
            })}
          </div>
        )}

        {/* Rich User Combobox Dropdown */}
        <div ref={userPickerRef} className="relative">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setUserDropdownOpen(true);
              }}
              onFocus={() => setUserDropdownOpen(true)}
              placeholder="Search by username, name, or role to grant individual permission…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-xs font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-muted/60"
            />
            <button
              type="button"
              onClick={() => setUserDropdownOpen((o) => !o)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Dropdown Menu Results */}
          {userDropdownOpen && (
            <div className="absolute z-50 top-[calc(100%+6px)] left-0 right-0 max-h-64 overflow-y-auto rounded-xl border border-line-strong bg-white dark:bg-card backdrop-blur-2xl shadow-2xl animate-fade-up">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted font-medium">
                  {allAccounts.length === 0 ? "No registered users found." : `No users matching "${userQuery}"`}
                </div>
              ) : (
                <div className="py-1">
                  {filteredUsers.map((u) => {
                    const isAlreadyAdded = assignedUserIds.includes(u.userId);
                    return (
                      <button
                        key={u.userId}
                        type="button"
                        onClick={() => handleAddUser(u.userId)}
                        disabled={isAlreadyAdded}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors text-left",
                          isAlreadyAdded
                            ? "bg-ink/5 opacity-60 cursor-not-allowed"
                            : "hover:bg-gray-50 dark:hover:bg-surface/80 cursor-pointer",
                        )}
                      >
                        <MinecraftAvatar username={u.username} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-ink truncate">{u.displayName || u.username}</div>
                          <div className="text-[10px] text-muted font-medium truncate">@{u.username} • {u.email}</div>
                        </div>
                        <RankChip role={u.role} />
                        {isAlreadyAdded && (
                          <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Added</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-line/60 pt-3">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm flex items-center gap-2">
          {busy ? <Save size={14} className="animate-spin" /> : <Check size={14} />}
          {busy ? "Saving…" : "Save permissions"}
        </button>
      </div>
    </form>
  );
}

export function PermissionsManager({
  modules,
  staffRoles,
  locked,
  allAccounts,
}: {
  modules: PermissionModuleConfig[];
  staffRoles: Role[];
  locked: Role[];
  allAccounts: PermissionAccount[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const categories = ["All", "Content", "Support", "Community", "Commerce", "System"];

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return modules.filter((mod) => {
      if (categoryFilter !== "All" && mod.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        mod.title.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        mod.category.toLowerCase().includes(q)
      );
    });
  }, [modules, query, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* Top Search & Category Filter Controls */}
      <div className="panel space-y-4 p-4 sm:p-5">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search permissions modules (e.g. Minecraft, News, Store, Tickets, Appeals…)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-muted/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
                  active
                    ? "border-accent/60 bg-accent/20 text-accent-bright"
                    : "border-line bg-ink/5 text-muted hover:border-line-strong hover:bg-ink/10 hover:text-ink",
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-6">
        {filteredModules.length === 0 ? (
          <div className="panel grid place-items-center gap-2 p-10 text-center">
            <Search size={24} className="text-muted" />
            <p className="font-semibold">No permission modules match your search</p>
            <p className="text-sm text-muted">Try a different category or search term.</p>
          </div>
        ) : (
          filteredModules.map((mod) => (
            <PermissionsEditor
              key={mod.id}
              title={mod.title}
              description={mod.description}
              staffRoles={staffRoles}
              selected={mod.selected}
              locked={mod.locked ?? locked}
              userIds={mod.userIds}
              allAccounts={allAccounts}
              saveAction={mod.saveAction}
            />
          ))
        )}
      </div>
    </div>
  );
}


