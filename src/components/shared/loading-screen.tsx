import Image from "next/image";
import { Box, Compass, Server } from "lucide-react";

export type LoadingVariant = "home" | "page" | "auth" | "portal";

const content: Record<LoadingVariant, { kicker: string; title: string; copy: string }> = {
  home: { kicker: "Mazora Network", title: "Generating your world…", copy: "Loading live players, community news, and the road ahead." },
  page: { kicker: "World travel", title: "Loading the next chunk…", copy: "Gathering everything you need for this part of Mazora." },
  auth: { kicker: "Player portal", title: "Securing your session…", copy: "Preparing a safe path back to your Mazora account." },
  portal: { kicker: "Network console", title: "Syncing player data…", copy: "Connecting your profile, progress, and community tools." },
};

export function LoadingScreen({ variant = "page" }: { variant?: LoadingVariant }) {
  const message = content[variant];
  const Icon = variant === "auth" ? Compass : variant === "portal" ? Server : Box;

  return (
    <section className={`state-loader state-loader-${variant}`} role="status" aria-live="polite" aria-label={message.title}>
      <div className="state-loader-atmosphere" aria-hidden="true" />
      <div className="state-loader-content">
        <Image src="/images/mazora-logo.png" alt="Mazora Network" width={210} height={140} priority className="state-loader-logo" />
        <p className="state-loader-kicker"><span /><Icon size={14} />{message.kicker}<span /></p>
        <div className="state-block-loader" aria-hidden="true"><i /><i /><i /><i /></div>
        <h1>{message.title}</h1>
        <p className="state-loader-copy">{message.copy}</p>
        <div className="state-loader-track" aria-hidden="true"><i /></div>
        <p className="state-loader-telemetry">JAVA + BEDROCK <span>•</span> mc.mazora.us</p>
      </div>
    </section>
  );
}
