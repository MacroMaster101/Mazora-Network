import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui";

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="glass flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-xl border border-line-strong bg-ink/5 text-muted">
        {icon ?? <Inbox size={24} />}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {action && (
        <Button href={action.href} variant="ghost" size="sm" className="mt-5">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong while loading this data." }: { message?: string }) {
  return (
    <div className="glass flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
