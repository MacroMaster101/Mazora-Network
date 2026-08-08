import { headers } from "next/headers";

/**
 * Renders a schema.org JSON-LD block.
 *
 * The nonce is not optional decoration. This site's CSP is nonce-based with
 * `strict-dynamic` and no 'unsafe-inline', and browsers apply script-src to
 * every <script> element — including data blocks that are never executed. An
 * unnonced ld+json tag is dropped before any crawler that enforces CSP can read
 * it, which is a silent failure: the markup looks correct in the source and
 * simply never counts.
 *
 * JSON.stringify output is escaped for "<" so a string inside the data can
 * never close the script element early.
 *
 * suppressHydrationWarning is required, not cosmetic — same reasoning as the
 * inline theme script in app/layout.tsx. Per the HTML spec a browser clears
 * the `nonce` content attribute once the element is parsed (it survives only
 * on the `.nonce` IDL property), so that CSS attribute selectors can't
 * exfiltrate it. React hydrating on the client therefore reads nonce="" while
 * the server sent the real value, and reports a mismatch for something the
 * browser did deliberately.
 *
 * Known dev-only quirk: on the homepage specifically (this component rendered
 * as a sibling before a <Suspense> boundary, in a route that also reads
 * dynamic `searchParams`), `next dev` still surfaces the hydration-mismatch
 * console warning despite suppressHydrationWarning — confirmed absent from a
 * production build, and absent here on every other page that uses this
 * component (e.g. news articles, which have no Suspense boundary). The
 * homepage works around it by inlining this exact script tag directly instead
 * of calling this component — see `src/app/(site)/page.tsx`. Root cause not
 * fully isolated; if a future page hits the same dev-only warning, inlining
 * is the known fix.
 */
export async function JsonLd({ data }: { data: object }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
