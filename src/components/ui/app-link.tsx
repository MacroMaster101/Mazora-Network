"use client";

// The one place allowed to import next/link (see eslint.config.mjs).
// eslint-disable-next-line no-restricted-imports
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ComponentProps, type FocusEvent, type MouseEvent, type TouchEvent } from "react";

type AppLinkProps = ComponentProps<typeof NextLink>;
type UrlObjectHref = Exclude<AppLinkProps["href"], string>;

/** Path plus query for an object href, matching what next/link navigates to. */
function urlObjectPath(href: UrlObjectHref): string | null {
  if (!href.pathname) return null;
  if (href.search) return `${href.pathname}${href.search.startsWith("?") ? href.search : `?${href.search}`}`;
  if (href.query && typeof href.query === "object") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(href.query)) {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
      else if (value !== undefined && value !== null) params.append(key, String(value));
    }
    const query = params.toString();
    return query ? `${href.pathname}?${query}` : href.pathname;
  }
  if (typeof href.query === "string" && href.query) return `${href.pathname}?${href.query}`;
  return href.pathname;
}

/**
 * next/link, prefetching on intent instead of on sight.
 *
 * Every page here renders per request (the CSP nonce makes the layout dynamic),
 * so Next's default viewport prefetch turned one page view into a server render
 * for every link on screen — 13 for the header alone, more for the footer and
 * any list of cards — and that was most of the Vercel function CPU. Links now
 * prefetch when the visitor points at, focuses or touches them, which keeps
 * navigation quick without paying for pages nobody opens.
 *
 * Passing `prefetch` explicitly keeps Next's own behaviour for that link.
 */
export default function AppLink({ prefetch, href, onMouseEnter, onFocus, onTouchStart, ...rest }: AppLinkProps) {
  const router = useRouter();
  const prefetched = useRef(false);

  if (prefetch !== undefined) {
    return <NextLink prefetch={prefetch} href={href} onMouseEnter={onMouseEnter} onFocus={onFocus} onTouchStart={onTouchStart} {...rest} />;
  }

  const warm = () => {
    if (prefetched.current) return;
    const target = typeof href === "string" ? href : urlObjectPath(href);
    // Only same-site paths; external and hash-only links have nothing to prefetch.
    if (!target || !target.startsWith("/") || target.startsWith("//")) return;
    prefetched.current = true;
    router.prefetch(target);
  };

  return (
    <NextLink
      prefetch={false}
      href={href}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        warm();
        onMouseEnter?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        warm();
        onFocus?.(event);
      }}
      onTouchStart={(event: TouchEvent<HTMLAnchorElement>) => {
        warm();
        onTouchStart?.(event);
      }}
      {...rest}
    />
  );
}
