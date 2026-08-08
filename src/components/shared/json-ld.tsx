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
 */
export async function JsonLd({ data }: { data: object }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
