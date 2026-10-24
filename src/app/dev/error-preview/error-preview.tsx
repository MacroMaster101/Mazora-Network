"use client";

import Link from "@/components/ui/app-link";
import { ErrorScreen } from "@/components/shared/error-screen";
import { GlobalErrorCard } from "@/components/shared/global-error-card";
import { ServiceNotice } from "@/components/shared/service-notice";

export type PreviewView = "error" | "compact" | "admin" | "not-found" | "global" | "notice";

/** A made-up digest: real ones come from Next and appear in the function logs. */
const SAMPLE_ERROR = Object.assign(new Error("Preview only"), { digest: "1234567890" });
const noop = () => {};

function Screen({ view }: { view: PreviewView }) {
  switch (view) {
    case "compact":
      return <ErrorScreen error={SAMPLE_ERROR} reset={noop} compact />;
    case "admin":
      return (
        <ErrorScreen
          error={SAMPLE_ERROR}
          reset={noop}
          code="ADMIN SYSTEM ERROR"
          title="This admin page could not load."
          copy="An unexpected issue interrupted this staff dashboard page. Try refreshing, or return to the Control Room."
          returnHref="/admin"
          returnLabel="Control room"
          compact
        />
      );
    case "not-found":
      return (
        <ErrorScreen
          kind="not-found"
          code="404 • LOST WORLD"
          title="These coordinates lead nowhere."
          copy="The page may have moved, been renamed, or never existed. Return to the network and choose another path."
        />
      );
    case "global":
      return <GlobalErrorCard digest={SAMPLE_ERROR.digest} reset={noop} />;
    case "notice":
      return (
        <>
          <ServiceNotice />
          <main style={{ padding: "4rem 1.25rem", textAlign: "center", opacity: 0.6 }}>The page renders below the notice.</main>
        </>
      );
    default:
      return <ErrorScreen error={SAMPLE_ERROR} reset={noop} />;
  }
}

export function ErrorPreview({ views, view }: { views: PreviewView[]; view: PreviewView }) {
  return (
    <>
      <Screen view={view} />
      <nav
        aria-label="Preview"
        style={{
          position: "fixed",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2147483647,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: 6,
          borderRadius: 12,
          background: "rgba(8,6,14,.88)",
          border: "1px solid rgba(216,180,254,.3)",
          font: "600 12px system-ui, sans-serif",
        }}
      >
        {views.map((item) => (
          <Link
            key={item}
            href={`/dev/error-preview?view=${item}`}
            style={{ padding: "6px 10px", borderRadius: 8, color: "#f9f7fc", background: item === view ? "#7c3aed" : "transparent" }}
          >
            {item}
          </Link>
        ))}
      </nav>
    </>
  );
}
