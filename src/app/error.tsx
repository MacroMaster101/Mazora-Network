"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-xl border border-danger/40 bg-danger/10 text-danger">
        <TriangleAlert size={26} />
      </span>
      <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        An unexpected error occurred while loading this page. You can try again — if it keeps happening, let us know.
      </p>
      <button onClick={reset} className="btn btn-primary mt-6">
        <RotateCcw size={16} /> Try again
      </button>
    </div>
  );
}
