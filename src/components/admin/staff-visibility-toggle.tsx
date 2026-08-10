"use client";

import { useActionState, useEffect } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  setStaffPublicVisibilityAction,
  type AdminActionResult,
} from "@/lib/actions/user-admin";
import { useToast } from "@/components/ui";

const initial: AdminActionResult = { ok: false, message: "" };

export function StaffVisibilityToggle({
  userId,
  visible,
}: {
  userId: string;
  visible: boolean;
}) {
  const [state, action, pending] = useActionState(setStaffPublicVisibilityAction, initial);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message) toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  const Icon = visible ? Eye : EyeOff;
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="visible" value={String(!visible)} />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-ghost btn-sm whitespace-nowrap disabled:opacity-60"
        aria-label={visible ? "Hide from public team" : "Show on public team"}
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
        {visible ? "Public" : "Hidden"}
      </button>
    </form>
  );
}
