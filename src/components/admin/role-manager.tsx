"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2 } from "lucide-react";
import type { Role } from "@/lib/types";
import { roleLabel, ROLES } from "@/lib/auth/roles";
import { changeUserRole } from "@/lib/actions/roles";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Inline rank editor.
 *
 * Confirm only appears once the selection actually differs from the saved rank,
 * so the control is quiet until there is something to do. On success the router
 * is refreshed rather than only updating local state: the rank chip, the tier
 * counts and the Staff board all read the same value, and leaving them stale
 * after a change is how a list starts lying about itself.
 */
export function RoleManager({
  userId,
  currentRole,
  assignable,
}: {
  userId: string;
  currentRole: Role;
  assignable: Role[];
}) {
  // The saved rank is tracked locally as well as in props, because the props
  // only catch up after the refresh completes.
  const [saved, setSaved] = useState<Role>(currentRole);
  const [choice, setChoice] = useState<Role>(currentRole);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const options = ROLES.filter(
    (role) => assignable.includes(role) || role === saved,
  );
  const dirty = choice !== saved;

  function save() {
    start(async () => {
      const result = await changeUserRole({ userId, newRole: choice });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setSaved(choice);
        router.refresh();
      } else {
        setChoice(saved);
      }
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        value={choice}
        onChange={(event) => setChoice(event.target.value as Role)}
        disabled={pending}
        aria-label="Rank"
        className={cn(
          "rounded-lg border bg-surface px-2.5 py-1.5 text-sm transition",
          dirty ? "border-accent/60" : "border-line",
          pending && "opacity-60",
        )}
      >
        {options.map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </select>

      {dirty && (
        <>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="btn btn-primary btn-sm disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            {pending ? "Saving…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setChoice(saved)}
            disabled={pending}
            aria-label="Discard rank change"
            className="cart-link-muted rounded-lg p-1.5 hover:text-ink disabled:opacity-60"
          >
            <Undo2 size={14} />
          </button>
        </>
      )}
    </span>
  );
}
