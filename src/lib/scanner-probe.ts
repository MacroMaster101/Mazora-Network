/**
 * Paths that only vulnerability scanners ask for: WordPress/PHP installers,
 * leaked dotfiles, admin tools for stacks this site does not run.
 *
 * Middleware answers these with a bare 404 before any page renders. Each probe
 * used to cost a full not-found render in a Vercel function (Fluid CPU); the
 * middleware runs at the edge, which is billed separately and far cheaper.
 * Nothing on this site lives under these paths, so no real visitor is affected.
 */
const SCANNER_EXTENSION = /\.(?:php\d?|phtml|asp|aspx|jsp|cgi|env|ini|sql|bak|old|swp|log)$/i;
const SCANNER_PREFIX = /^\/(?:wp-|wordpress|xmlrpc|phpmyadmin|pma|cgi-bin|vendor\/|boaform|actuator|owa\/|hnap1)/i;
// Framework debug consoles and PHP info pages, wherever they appear in the path
// (/_profiler/phpinfo, /admin/phpinfo, /_ignition/execute-solution, /_environment…).
const SCANNER_SEGMENT = /(?:^|\/)(?:phpinfo|_profiler|_ignition|_environment|telescope|server-status|server-info)(?:\/|$)/i;

export function isScannerProbe(pathname: string): boolean {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return true; // malformed encoding is never a real page
  }
  if (SCANNER_EXTENSION.test(path) || SCANNER_PREFIX.test(path) || SCANNER_SEGMENT.test(path)) return true;
  // Dotfiles and dot-directories (/.git/config, /.env, /.aws/credentials),
  // except the standard /.well-known/ tree.
  return path.split("/").some((segment) => segment.startsWith(".") && segment !== ".well-known" && segment !== "." && segment !== "..");
}
