"use client";

import { useState } from "react";
import { Ban, Save } from "lucide-react";
import { ROLE_ICONS, type RoleDef } from "@/lib/auth/role-catalog-core";
import { badgeStyle } from "@/lib/auth/role-colors";
import { badgeIconFor, ROLE_ICON_COMPONENTS, roleIconLabel } from "@/lib/auth/role-icons";
import { bandOrder, deriveRoleKey, type RoleInput } from "@/lib/roles-rules";
import type { ALL_PERMISSION_KEYS } from "@/lib/auth/permissions";
import { ColorPicker } from "@/components/admin/color-picker";
import { Input, Modal, Select, Textarea } from "@/components/ui";

/** Human names for every admin module, matching the Permissions page titles. */
export const MODULE_LABELS: Record<(typeof ALL_PERMISSION_KEYS)[number], string> = {
  "pages.permissions": "Page Content Hub",
  "forums.permissions": "Community Forums",
  "content-creators.permissions": "Content Creator Directory",
  "news.permissions": "Announcements & Newsroom",
  "gallery.permissions": "Community Gallery & Moderation",
  "play.permissions": "Play Page & Connection Settings",
  "events.permissions": "Events & Tournaments",
  "gamemodes.permissions": "Game Modes & Server Directory",
  "rules.permissions": "Server Rules & Guidelines",
  "support.permissions": "Support Center & Help Cards",
  "appeals.permissions": "Appeals & Application Intake Forms",
  "suggestions.permissions": "Community Suggestions",
  "store.permissions": "Store Catalogue & Discount Codes",
  "orders.permissions": "Orders & Transaction Browser",
  "voting.permissions": "Voting Partners & Rewards",
  "minecraft.permissions": "Minecraft Players & IGN Claims",
  "users.permissions": "User Management & Role Directory",
  "staff.permissions": "Staff Roster & Public Visibility",
  "roles.assign.permissions": "Assign roles",
  "notifications.permissions": "System Broadcasts & Announcements",
  "bot.permissions": "Mazora Bot Console",
  "settings.permissions": "Site Settings",
  "audit.permissions": "Audit Logs",
};

const moduleLabel = (key: string) => (MODULE_LABELS as Record<string, string>)[key] ?? key;

export const BADGE_CLASS = "rank-chip inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap";

export type EditorTarget = { mode: "create" } | { mode: "edit"; role: RoleDef };
export type CreatePayload = RoleInput & { aboveKey: string | null; modules: string[] };
export type UpdatePayload = Partial<Pick<RoleInput, "label" | "color" | "icon" | "description" | "showOnTeam">> & { modules?: string[] };

interface Props {
  target: EditorTarget | null;
  roles: RoleDef[];
  grants: Record<string, string[]>;
  moduleKeys: string[];
  pending: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePayload) => void;
  onUpdate: (key: string, patch: UpdatePayload) => void;
}

export function RoleEditorModal(props: Props) {
  const { target, onClose } = props;
  const title = target?.mode === "edit" ? `Edit ${target.role.label}` : "New role";
  return (
    <Modal open={target !== null} onClose={onClose} label={title} size="editor">
      {target && <RoleEditorForm key={target.mode === "edit" ? target.role.key : "__create__"} {...props} target={target} title={title} />}
    </Modal>
  );
}

const fieldLabel = "block text-xs font-bold uppercase tracking-wider text-muted";

function RoleEditorForm({ target, title, roles, grants, moduleKeys, pending, onClose, onCreate, onUpdate }: Props & { target: EditorTarget; title: string }) {
  const editing = target.mode === "edit" ? target.role : null;
  const [label, setLabel] = useState(editing?.label ?? "");
  const [key, setKey] = useState(editing?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(false);
  const [color, setColor] = useState(editing?.color ?? "#a855f7");
  const [icon, setIcon] = useState<string>(editing?.icon ?? "");
  const PreviewIcon = badgeIconFor(icon);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [kind, setKind] = useState<"staff" | "public">(editing?.kind === "public" ? "public" : "staff");
  const [aboveKey, setAboveKey] = useState<string>("");
  const [showOnTeam, setShowOnTeam] = useState(editing ? editing.showOnTeam : true);
  const [modules, setModules] = useState<string[]>(editing ? (grants[editing.key] ?? []).filter((m) => moduleKeys.includes(m)) : []);

  const isStaff = editing ? editing.kind === "staff" : kind === "staff";
  // Locked staff roles (Owner / Web Dev) have fixed module access, so no checklist.
  const showModules = isStaff && !editing?.locked;
  const byKey = new Map(roles.map((r) => [r.key, r]));
  const bandRoles = [...bandOrder(roles, kind)].reverse().map((k) => byKey.get(k)!).filter(Boolean);
  const copySources = roles.filter((r) => r.kind === "staff" && r.key !== editing?.key);

  const onLabel = (value: string) => {
    setLabel(value);
    if (!editing && !keyTouched) setKey(deriveRoleKey(value));
  };
  const toggleModule = (m: string) => setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  function submit() {
    const trimmedIcon = icon === "" ? null : icon;
    if (editing) {
      const patch: UpdatePayload = { label, color, icon: trimmedIcon, description };
      if (editing.kind === "staff") patch.showOnTeam = showOnTeam;
      if (showModules) {
        // Keep grants for modules this viewer cannot see (e.g. IT-only Audit) — the action replaces the whole set.
        const hidden = (grants[editing.key] ?? []).filter((m) => !moduleKeys.includes(m));
        patch.modules = [...modules, ...hidden];
      }
      onUpdate(editing.key, patch);
    } else {
      onCreate({
        key, label, color, icon: trimmedIcon, description, kind,
        showOnTeam: kind === "staff" && showOnTeam,
        aboveKey: aboveKey === "" ? null : aboveKey,
        modules: kind === "staff" ? modules : [],
      });
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="panel overflow-hidden">
      <div className="border-b border-line px-5 py-5 pr-16 sm:px-6">
        <p className="eyebrow">{editing ? (editing.locked ? "Locked role" : "Edit role") : "Create role"}</p>
        <h2 className="mt-2 font-display text-2xl font-black">{title}</h2>
        {editing?.locked && <p className="mt-1 text-sm text-muted">🔒 This role is built in: you can rename and restyle it, but not move, delete or change its access.</p>}
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <label className={fieldLabel}>Name
            <Input value={label} onChange={(e) => onLabel(e.target.value)} maxLength={32} className="mt-1.5 w-full normal-case" required autoFocus />
          </label>
          {!editing && (
            <label className={fieldLabel}>Role ID
              <Input
                value={key}
                onChange={(e) => {
                  const next = e.target.value.toLowerCase();
                  // Clearing the ID hands it back to the name: auto-derive resumes on the next keystroke there.
                  setKeyTouched(next !== "");
                  setKey(next);
                }}
                maxLength={32}
                className="mt-1.5 w-full font-mono normal-case"
                required
              />
              <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal">Permanent once created. Lower-case letters, numbers and _.</span>
            </label>
          )}
          <fieldset>
            <legend className={fieldLabel}>Icon</legend>
            <div role="radiogroup" aria-label="Icon" className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {(["", ...ROLE_ICONS] as const).map((name) => {
                const Icon = name ? ROLE_ICON_COMPONENTS[name] : Ban;
                const selected = icon === name;
                return (
                  <button
                    key={name || "none"}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setIcon(name)}
                    className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold normal-case tracking-normal transition-colors ${
                      selected
                        ? "border-accent bg-accent/15 text-ink"
                        : "border-line text-muted hover:border-accent/50 hover:text-ink"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" aria-hidden />
                    <span className="truncate">{name ? roleIconLabel(name) : "No icon"}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className={fieldLabel}>Description
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} rows={3} className="mt-1.5 w-full normal-case" />
            <span className="mt-1 block text-right text-[11px] normal-case tracking-normal">{description.length}/160</span>
          </label>

          {!editing && (
            <fieldset>
              <legend className={fieldLabel}>Type</legend>
              <div className="mt-1.5 flex gap-4 text-sm">
                {(["staff", "public"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="role-kind" checked={kind === k} onChange={() => { setKind(k); setAboveKey(""); }} />
                    {k === "staff" ? "Staff (opens the admin panel)" : "Public (badge only)"}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {!editing && (
            <label className={fieldLabel}>Directly above
              <Select value={aboveKey} onChange={(e) => setAboveKey(e.target.value)} className="mt-1.5 w-full normal-case">
                {bandRoles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                <option value="">Bottom of the band</option>
              </Select>
            </label>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <p className={fieldLabel}>Colour</p>
            <div className="mt-1.5"><ColorPicker value={color} onChange={setColor} /></div>
          </div>
          <div>
            <p className={fieldLabel}>Preview</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <div key={theme} data-theme={theme} className="role-preview rounded-xl border border-line p-3">
                  <span className="role-preview-caption mb-2 block text-[10px] font-bold uppercase tracking-wider">{theme} theme</span>
                  <span style={badgeStyle(color)} className={BADGE_CLASS}>{PreviewIcon && <PreviewIcon className="h-[1.1em] w-[1.1em] shrink-0" strokeWidth={2.5} aria-hidden />}{label.trim() || "Role name"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isStaff && (
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={showOnTeam} onChange={(e) => setShowOnTeam(e.target.checked)} />
              Show on Our Team
            </label>
            {showModules && (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <p className={fieldLabel}>Admin boards</p>
                  <label className="text-xs font-semibold text-muted">Copy from{" "}
                    <Select
                      value=""
                      onChange={(e) => { const from = e.target.value; if (from) setModules((grants[from] ?? []).filter((m) => moduleKeys.includes(m))); }}
                      className="ml-1 inline-block w-auto py-1 text-xs"
                    >
                      <option value="">Choose a role…</option>
                      {copySources.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </Select>
                  </label>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {moduleKeys.map((m) => (
                    <label key={m} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <input type="checkbox" checked={modules.includes(m)} onChange={() => toggleModule(m)} />
                      {moduleLabel(m)}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" className="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60" onClick={onClose} disabled={pending}>Cancel</button>
        <button type="submit" className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={pending}>
          <Save size={15} /> {pending ? "Saving…" : editing ? "Save role" : "Create role"}
        </button>
      </div>
    </form>
  );
}
