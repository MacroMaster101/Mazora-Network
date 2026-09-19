"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { RoleDef } from "@/lib/auth/role-catalog-core";
import { badgeStyle } from "@/lib/auth/role-colors";
import { badgeIconFor } from "@/lib/auth/role-icons";
import { bandOrder, deleteDestination, editableFields, isValidDeleteDestination } from "@/lib/roles-rules";
import { createRoleAction, deleteRoleAction, reorderRolesAction, updateRoleAction } from "@/lib/actions/role-catalog";
import { Modal, Select, useToast } from "@/components/ui";
import { BADGE_CLASS, RoleEditorModal, type CreatePayload, type EditorTarget, type UpdatePayload } from "@/components/admin/role-editor-modal";

type Band = "staff" | "public";
type Result = { ok: boolean; message: string };

interface Props {
  /** Highest first. */
  roles: RoleDef[];
  counts: Record<string, number>;
  grants: Record<string, string[]>;
  moduleKeys: string[];
  /** The signed-in manager's role — decides which delete destinations are offered. */
  actorRole: string;
}

/**
 * The Roles page: staff and public ladders, reordering, and the create / edit /
 * delete dialogs. Badges are drawn from the props (not the client registry) so
 * a just-saved colour or name shows as soon as the page refreshes.
 */
export function RoleCatalogManager({ roles, counts, grants, moduleKeys, actorRole }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [deleting, setDeleting] = useState<RoleDef | null>(null);
  const [destination, setDestination] = useState("");
  // Optimistic band order (lowest → highest) while a reorder is saving; cleared by fresh props.
  const [override, setOverride] = useState<Partial<Record<Band, string[]>>>({});
  useEffect(() => setOverride({}), [roles]);

  const byKey = useMemo(() => new Map(roles.map((r) => [r.key, r])), [roles]);

  function run(action: () => Promise<Result>, onSuccess?: () => void, onFailure?: () => void) {
    start(async () => {
      let result: Result;
      try {
        result = await action();
      } catch {
        result = { ok: false, message: "Something went wrong. Try again." };
      }
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) onSuccess?.();
      else onFailure?.();
      if (result.ok || onFailure) router.refresh();
    });
  }

  function saveOrder(kind: Band, lowestFirst: string[]) {
    setOverride((cur) => ({ ...cur, [kind]: lowestFirst }));
    run(() => reorderRolesAction(kind, lowestFirst), undefined, () => setOverride((cur) => ({ ...cur, [kind]: undefined })));
  }

  const onCreate = (payload: CreatePayload) => run(() => createRoleAction(payload), () => setEditor(null));
  const onUpdate = (key: string, patch: UpdatePayload) => run(() => updateRoleAction(key, patch), () => setEditor(null));

  const destinations = deleting
    ? roles.filter((r) => r.key !== deleting.key && isValidDeleteDestination(roles, deleting.key, r.key, actorRole))
    : [];
  function openDelete(role: RoleDef) {
    const valid = roles.filter((r) => r.key !== role.key && isValidDeleteDestination(roles, role.key, r.key, actorRole));
    const preferred = deleteDestination(roles, role.key);
    setDestination(valid.some((r) => r.key === preferred) ? preferred : valid[0]?.key ?? "");
    setDeleting(role);
  }
  const confirmDelete = () => {
    if (!deleting || !destination) return;
    const key = deleting.key;
    run(() => deleteRoleAction(key, destination), () => setDeleting(null));
  };

  const columns: { kind: Band; title: string; hint: string }[] = [
    { kind: "staff", title: "Staff ranks", hint: "Open the admin panel. Owner and Web Dev stay on top." },
    { kind: "public", title: "Public ranks", hint: "Badges shown on profiles. Member is everyone's base rank." },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => setEditor({ mode: "create" })}>
          <Plus size={14} /> New role
        </button>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {columns.map(({ kind, title, hint }) => {
          const movable = (override[kind] ?? bandOrder(roles, kind)).map((k) => byKey.get(k)).filter((r): r is RoleDef => !!r);
          const movableHighFirst = [...movable].reverse();
          const lockedTop = roles.filter((r) => r.kind === kind && !movable.includes(r));
          const lockedBottom = kind === "public" ? roles.filter((r) => r.key === "member") : [];
          return (
            <BandColumn
              key={kind}
              title={title}
              hint={hint}
              lockedTop={lockedTop}
              movable={movableHighFirst}
              lockedBottom={lockedBottom}
              counts={counts}
              pending={pending}
              onEdit={(role) => setEditor({ mode: "edit", role })}
              onDelete={openDelete}
              onReorder={(highFirst) => saveOrder(kind, [...highFirst].reverse())}
            />
          );
        })}
      </div>

      <RoleEditorModal
        target={editor}
        roles={roles}
        grants={grants}
        moduleKeys={moduleKeys}
        pending={pending}
        onClose={() => setEditor(null)}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} label={deleting ? `Delete ${deleting.label}` : "Delete role"} size="compact">
        {deleting && (
          <div className="panel overflow-hidden p-5 sm:p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-danger/25 bg-danger/10 text-danger"><AlertTriangle size={21} /></span>
            <h2 className="mt-4 font-display text-xl font-black">Delete {deleting.label}?</h2>
            {destinations.length > 0 ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {counts[deleting.key] ?? 0} member(s) hold <strong className="text-ink">{deleting.label}</strong>. Move them to:
                </p>
                <Select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-3 w-full" aria-label="Move members to">
                  {destinations.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </Select>
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                There is no role below {deleting.label} that you can move its members to, so it cannot be deleted.
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setDeleting(null)} disabled={pending}>Keep role</button>
              <button
                type="button"
                className="btn btn-primary bg-danger disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending || destinations.length === 0 || !destination}
                onClick={confirmDelete}
              >
                <Trash2 size={15} /> {pending ? "Deleting…" : "Delete role"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Compact row action: same 28px height as the ▲/▼ buttons (utilities override .btn's size). */
const ACTION_BUTTON = "h-7 shrink-0 gap-1 rounded-lg px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-60";

const holderLabel = (count: number) => `${count} ${count === 1 ? "member" : "members"}`;

function BandColumn({
  title, hint, lockedTop, movable, lockedBottom, counts, pending, onEdit, onDelete, onReorder,
}: {
  title: string;
  hint: string;
  lockedTop: RoleDef[];
  movable: RoleDef[];
  lockedBottom: RoleDef[];
  counts: Record<string, number>;
  pending: boolean;
  onEdit: (role: RoleDef) => void;
  onDelete: (role: RoleDef) => void;
  onReorder: (highFirst: string[]) => void;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const keys = movable.map((r) => r.key);
  // Arrow buttons keyed by `${roleKey}:up|down`, so focus can follow a role after a keyboard move.
  const arrows = useRef(new Map<string, HTMLButtonElement>());
  const [refocus, setRefocus] = useState<string | null>(null);
  const order = keys.join();
  useEffect(() => {
    // Buttons are disabled while the reorder saves; wait until they are usable again.
    if (!refocus || pending) return;
    const button = arrows.current.get(refocus);
    if (button && !button.disabled) button.focus();
    else if (button) arrows.current.get(refocus.endsWith(":up") ? refocus.replace(/:up$/, ":down") : refocus.replace(/:down$/, ":up"))?.focus();
    setRefocus(null);
  }, [refocus, pending, order]);
  const arrowRef = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) arrows.current.set(id, el);
    else arrows.current.delete(id);
  };

  function move(from: number, to: number) {
    setDragged(null);
    setOver(null);
    if (pending || from === to || from < 0 || to < 0 || from >= keys.length || to >= keys.length) return;
    const next = [...keys];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }

  const row = (role: RoleDef, index: number | null) => {
    const fields = editableFields(role);
    const RowIcon = badgeIconFor(role.icon);
    const draggable = index !== null && !pending;
    return (
      <li
        key={role.key}
        draggable={draggable}
        onDragStart={(e) => {
          if (index === null) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(index));
          setDragged(index);
        }}
        onDragOver={(e) => {
          if (index === null || dragged === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(index);
        }}
        onDragLeave={() => setOver((cur) => (cur === index ? null : cur))}
        onDrop={(e) => {
          if (index === null) return;
          e.preventDefault();
          const from = Number(e.dataTransfer.getData("text/plain"));
          if (!Number.isNaN(from)) move(from, index);
        }}
        onDragEnd={() => { setDragged(null); setOver(null); }}
        className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-surface/65 px-3 py-2.5 transition ${
          index !== null && dragged === index ? "opacity-50 border-accent/50" : index !== null && over === index ? "border-accent bg-accent/10" : "border-line"
        }`}
      >
        {/* Identity: grows to fill, and wraps within itself before anything overflows. */}
        <div className="flex min-w-0 flex-[1_1_auto] flex-wrap items-center gap-2">
          {index !== null ? (
            <GripVertical size={15} className="shrink-0 cursor-grab text-muted active:cursor-grabbing" aria-hidden />
          ) : (
            <span className="w-[15px] shrink-0" aria-hidden />
          )}
          <span style={badgeStyle(role.color)} className={`${BADGE_CLASS} max-w-full overflow-hidden text-ellipsis`}>{RowIcon && <RowIcon className="h-[1.1em] w-[1.1em] shrink-0" strokeWidth={2.5} aria-hidden />}{role.label}</span>
          {role.locked && <span role="img" aria-label="Locked" title="Locked role" className="shrink-0">🔒</span>}
          <span className="shrink-0 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">
            {holderLabel(counts[role.key] ?? 0)}
          </span>
        </div>
        {/* Actions: never shrink; on a narrow card they drop to their own line, right-aligned. */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {index !== null && (
            <>
              <button type="button" ref={arrowRef(`${role.key}:up`)} disabled={pending || index === 0} onClick={() => { setRefocus(`${role.key}:up`); move(index, index - 1); }} aria-label={`Move ${role.label} up`} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-accent/10 hover:text-ink disabled:opacity-25"><ArrowUp size={14} /></button>
              <button type="button" ref={arrowRef(`${role.key}:down`)} disabled={pending || index === keys.length - 1} onClick={() => { setRefocus(`${role.key}:down`); move(index, index + 1); }} aria-label={`Move ${role.label} down`} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-accent/10 hover:text-ink disabled:opacity-25"><ArrowDown size={14} /></button>
            </>
          )}
          <button type="button" className={`btn btn-secondary ${ACTION_BUTTON}`} disabled={pending} onClick={() => onEdit(role)} aria-label={`Edit ${role.label}`}><Pencil size={12} /> Edit</button>
          {fields.delete && (
            <button type="button" className={`btn btn-ghost text-danger ${ACTION_BUTTON}`} disabled={pending} onClick={() => onDelete(role)} aria-label={`Delete ${role.label}`}><Trash2 size={12} /> Delete</button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="panel min-w-0 overflow-hidden p-4 sm:p-5">
      <h2 className="font-display text-lg font-black text-ink">{title}</h2>
      <p className="mt-1 text-xs text-muted">{hint} Drag rows, or use the arrows, to reorder.</p>
      <ul className="mt-4 min-w-0 space-y-2">
        {lockedTop.map((role) => row(role, null))}
        {movable.map((role, i) => row(role, i))}
        {lockedBottom.map((role) => row(role, null))}
      </ul>
      {movable.length === 0 && <p className="mt-3 text-xs text-muted">No movable roles in this band yet.</p>}
    </section>
  );
}
