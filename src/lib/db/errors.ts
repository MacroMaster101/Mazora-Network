const TRANSIENT_CONNECTION_CODES = new Set([
  "CONNECT_TIMEOUT",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
]);

export function databaseConnectionErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === "string" && TRANSIENT_CONNECTION_CODES.has(value.code)) return value.code;
    current = value.cause;
  }
  return null;
}

/**
 * Expected connection outages should not become a Next.js development error
 * overlay. Unexpected query/schema failures stay errors so they remain visible.
 */
export function reportDatabaseReadFailure(label: string, error: unknown): void {
  const code = databaseConnectionErrorCode(error);
  if (code) {
    console.warn(`${label}: database temporarily unavailable (${code}).`);
    return;
  }
  console.error(label, error);
}
