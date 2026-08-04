import Link from "next/link";
import { MapPinned, Home, Compass } from "lucide-react";

export default function AdminNotFound() {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-black/85 backdrop-blur-2xl animate-fade-in">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(247,201,72,0.15),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl text-center space-y-6 panel p-8 sm:p-10 border-gold/40 bg-card/95 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.95)]">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/mazora-logo.webp"
            alt="Mazora Network"
            className="h-12 w-auto object-contain filter drop-shadow-md"
          />
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/40 bg-gold/10 text-gold shadow-inner">
            <MapPinned size={28} />
          </div>
        </div>

        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-gold">
            404 • ADMIN ROUTE NOT FOUND
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink mt-1.5 leading-tight">
            This staff page does not exist.
          </h1>
          <p className="text-sm text-muted mt-2.5 leading-relaxed max-w-md mx-auto">
            The tool may have moved or may not be available for this staff role. Return to the Control Room to select another board.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/admin"
            className="btn btn-gold gap-2 font-bold text-xs py-2.5 px-4"
          >
            <Home size={15} /> Control room
          </Link>

          <Link
            href="/support"
            className="btn btn-ghost text-xs gap-1.5 font-bold text-muted hover:text-ink"
          >
            <Compass size={15} /> Get support
          </Link>
        </div>
      </div>
    </div>
  );
}