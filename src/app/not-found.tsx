import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(48rem_28rem_at_50%_10%,rgba(139,92,246,0.12),transparent_60%)]" />
      <div className="relative">
        <Logo />
        <p className="telemetry mt-10 text-7xl font-bold text-accent-bright">404</p>
        <h1 className="mt-3 text-3xl font-bold">This world doesn&apos;t exist</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          The page you&apos;re looking for may have been moved, renamed, or never existed. Let&apos;s get you back on the map.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            <Compass size={16} /> Back home
          </Link>
          <Link href="/game-modes" className="btn btn-ghost">
            Explore game modes
          </Link>
        </div>
      </div>
    </div>
  );
}
