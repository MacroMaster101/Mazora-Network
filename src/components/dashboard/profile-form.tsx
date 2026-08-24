"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { updateProfileAction, type AccountActionResult } from "@/lib/actions/account";
import { FormRow, Input, Textarea, useToast } from "@/components/ui";

const initialState: AccountActionResult = { ok: false };

export function ProfileForm({
  username,
  displayName,
  bio,
}: {
  username: string;
  displayName: string;
  bio: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) router.refresh();
  }, [state, toast, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Display name" htmlFor="displayName" error={state.errors?.displayName}>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={displayName}
            minLength={2}
            maxLength={64}
            required
            aria-invalid={Boolean(state.errors?.displayName)}
          />
        </FormRow>
        <FormRow label="Username" htmlFor="username" hint="Synced with Minecraft IGN">
          <Input id="username" value={username} disabled />
        </FormRow>
      </div>
      <FormRow label="Bio" htmlFor="bio" hint="500 characters max" error={state.errors?.bio}>
        <Textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={500}
          defaultValue={bio}
          placeholder="Tell the community a little about yourself…"
          aria-invalid={Boolean(state.errors?.bio)}
        />
      </FormRow>
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}