import type { ComponentPropsWithRef, ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between text-sm font-medium">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn("field", className)} {...props} />;
}

/** Takes a ref (React 19 passes it as a plain prop) so callers can read or
 *  re-assert the DOM value — a form action reset otherwise leaves it stale. */
export function Select({ className, children, ...props }: ComponentPropsWithRef<"select">) {
  return (
    <select className={cn("field appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

/** Label + control + optional error, vertically stacked. */
export function FormRow({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error && <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
