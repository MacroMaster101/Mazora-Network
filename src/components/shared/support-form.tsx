"use client";

import { useActionState, useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/actions/support";
import { FormRow, Input, Select, Textarea, useToast } from "@/components/ui";

export interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "url" | "date";
  options?: string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

type ServerAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false };

export function SupportForm({
  action,
  fields,
  submitLabel = "Submit",
}: {
  action: ServerAction;
  fields: FieldConfig[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast(state.message, "success");
    else if (!state.ok && state.message) toast(state.message, "error");
  }, [state, toast]);

  if (state.ok) {
    return (
      <div className="glass flex flex-col items-center px-6 py-14 text-center">
        <CheckCircle2 size={40} className="text-accent-bright" />
        <h2 className="mt-4 font-display text-xl font-bold">Submitted</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="glass space-y-5 p-6 sm:p-8">
      {fields.map((f) => (
        <FormRow key={f.name} label={f.label} htmlFor={f.name} hint={f.hint} error={state.errors?.[f.name]}>
          {f.type === "textarea" ? (
            <Textarea id={f.name} name={f.name} rows={5} placeholder={f.placeholder} required={f.required} />
          ) : f.type === "select" ? (
            <Select id={f.name} name={f.name} defaultValue="" required={f.required}>
              <option value="" disabled>
                Select…
              </option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={f.name}
              name={f.name}
              type={f.type === "url" ? "url" : f.type === "date" ? "date" : "text"}
              placeholder={f.placeholder}
              required={f.required}
            />
          )}
        </FormRow>
      ))}

      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-70">
        {pending && <Loader2 size={16} className="animate-spin" />}
        {pending ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}
