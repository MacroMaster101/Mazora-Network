"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import type { GameMode } from "@/lib/types";
import { deleteStoreModeAction, toggleStoreModeAction, type StoreAdminActionResult } from "@/lib/actions/store-admin";
import { AdminTable, type Column } from "@/components/admin/admin-table";
import { Icon } from "@/components/shared/icon";
import { useToast } from "@/components/ui";
import { GameModeFormModal, type GameModeDraft } from "./game-mode-form-modal";

function ToggleButton({ id, enabled }: { id?: string; enabled: boolean }) {
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={busy || !id}
      className={`btn btn-xs ${enabled ? "btn-secondary" : "btn-primary"}`}
      onClick={() => start(async () => {
        const data = new FormData();
        data.set("id", id ?? "");
        data.set("enabled", String(!enabled));
        const result: StoreAdminActionResult = await toggleStoreModeAction(data);
        toast(result.message, result.ok ? "success" : "error");
        if (result.ok) router.refresh();
      })}
    >
      {enabled ? <EyeOff size={13} /> : <Eye size={13} />}
      {busy ? "Saving…" : enabled ? "Hide" : "Show"}
    </button>
  );
}

function DeleteButton({ id, name }: { id?: string; name: string }) {
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={busy || !id}
      className="btn btn-danger btn-xs"
      onClick={() => {
        if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
        start(async () => {
          const data = new FormData();
          data.set("id", id ?? "");
          const result = await deleteStoreModeAction(data);
          toast(result.message, result.ok ? "success" : "error");
          if (result.ok) router.refresh();
        });
      }}
    >
      <Trash2 size={13} /> {busy ? "Deleting…" : "Delete"}
    </button>
  );
}

export function GameModesTable({ modes }: { modes: GameMode[] }) {
  const [draft, setDraft] = useState<GameModeDraft | undefined>();

  const columns: Column<GameMode>[] = [
    {
      header: "Mode",
      cell: (m) => (
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-card/60 text-accent-bright">
            <Icon name={m.icon} size={15} />
          </span>
          <span className="font-semibold">{m.name}</span>
        </span>
      ),
    },
    { header: "Slug", cell: (m) => <span className="telemetry text-muted">{m.slug}</span> },
    { header: "Version", cell: (m) => <span className="telemetry text-muted">{m.version}</span> },
    { header: "Players", cell: (m) => <span className="telemetry">{m.players}</span> },
    {
      header: "Status",
      cell: (m) => {
        if (m.enabled === false) {
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
              <EyeOff size={11} /> Hidden
            </span>
          );
        }
        if (m.storeStatus === "live") {
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" /> Live
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            Coming soon
          </span>
        );
      },
    },
    {
      header: "Actions",
      align: "right",
      cell: (m) => (
        <span className="flex items-center justify-end gap-1.5">
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => setDraft(m)}><Edit3 size={13} /> Edit</button>
          <ToggleButton id={m.id} enabled={m.enabled !== false} />
          <DeleteButton id={m.id} name={m.name} />
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(null)}>
          <Plus size={15} /> New game mode
        </button>
      </div>
      <AdminTable columns={columns} rows={modes} />
      <GameModeFormModal draft={draft} modesCount={modes.length} onClose={() => setDraft(undefined)} variant="dashboard" />
    </>
  );
}
