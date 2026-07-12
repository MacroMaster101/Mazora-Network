import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** A card-shaped skeleton block used across loading states. */
export function CardSkeleton() {
  return (
    <div className="panel p-5">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
    </div>
  );
}
