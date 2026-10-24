/**
 * Server start-up and error hooks (Next.js instrumentation).
 *
 * `register` runs once per server process: it checks the environment and
 * logs what is missing or malformed (names only, never values) so a bad
 * variable shows in the function logs at boot instead of as an empty page.
 *
 * `onRequestError` runs for every uncaught error in a page, route handler,
 * server action or middleware. It logs one structured line with the digest the
 * error page shows the visitor, so a report of "the page broke, code 12345"
 * can be found in the logs. It is also where an error tracker hooks in: with
 * one installed (Sentry, for example), forward the same arguments to it here.
 * Request headers are never logged; they carry the session cookies.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnvironment } = await import("@/lib/env");
  const problems = checkEnvironment(process.env, { production: process.env.NODE_ENV === "production" });
  if (problems.length) console.error(`Environment check: ${problems.length} problem(s)\n- ${problems.join("\n- ")}`);
}

type RequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
};

export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: RequestErrorContext,
) {
  const failure = error instanceof Error ? error : new Error(String(error));
  console.error(
    JSON.stringify({
      event: "request_error",
      digest: (failure as Error & { digest?: string }).digest ?? null,
      name: failure.name,
      message: failure.message,
      method: request.method ?? null,
      // The route pattern (/players/[username]), not the visited path, so a
      // member's name in the URL does not end up in the logs.
      route: context.routePath ?? null,
      routeType: context.routeType ?? null,
      renderSource: context.renderSource ?? null,
      stack: failure.stack?.split("\n").slice(0, 8).join("\n") ?? null,
    }),
  );
}
