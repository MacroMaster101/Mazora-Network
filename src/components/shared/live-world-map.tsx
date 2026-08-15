"use client";

import { useRef, useState } from "react";
import { ExternalLink, LocateFixed } from "lucide-react";

export function LiveWorldMap({ mapUrl }: { mapUrl: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [resetMessage, setResetMessage] = useState("");

  const resetToSpawn = () => {
    const resetUrl = new URL(mapUrl);

    // A clean Dynmap URL resolves to the server's configured default world,
    // map layer, zoom, and center. The changing token forces a reload even
    // when the user presses reset more than once from the same map position.
    resetUrl.search = "";
    resetUrl.hash = "";
    resetUrl.searchParams.set("mazora-reset", String(Date.now()));

    if (frameRef.current) frameRef.current.src = resetUrl.toString();
    setResetMessage("Map centered on spawn.");
  };

  return (
    <div className="home-map-frame-wrap">
      <iframe
        ref={frameRef}
        src={mapUrl}
        title="Mazora Network live Minecraft world map"
        className="home-map-frame"
        loading="lazy"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        /*
          `allow-modals` is deliberately absent.

          When the map backend cannot reach the server it calls window.alert(),
          and a framed page's alert is modal over the WHOLE document — visitors
          to the homepage got a browser dialog reading "An embedded page at
          map.mazora.us says: Could not retrieve configuration: error" before
          they had scrolled anywhere near the map. Without this flag the browser
          ignores alert/confirm/prompt from the frame and logs a notice instead,
          so a map outage stays inside the map.

          allow-same-origin is safe here precisely because the frame is a
          different origin (map.mazora.us): it restores that document's access
          to its OWN origin, not to mazora.us. It would only be self-defeating
          on a same-origin frame, which could then drop its own sandbox.
        */
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
      />
      <div className="home-map-actions">
        <button type="button" className="home-map-reset" onClick={resetToSpawn}>
          <LocateFixed size={15} /> Reset to spawn
        </button>
        <a className="home-map-open" href={mapUrl} target="_blank" rel="noreferrer">
          Open full map <ExternalLink size={15} />
        </a>
      </div>
      <span className="sr-only" aria-live="polite">{resetMessage}</span>
    </div>
  );
}
