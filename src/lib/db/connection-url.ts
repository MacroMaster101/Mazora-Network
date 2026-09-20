const SUPABASE_POOLER_HOST_SUFFIX = ".pooler.supabase.com";

/**
 * Supabase exposes transaction pooling on 6543 and session pooling on 5432.
 * Local development uses the session pooler because it is less susceptible to
 * transient transaction-pooler handshake failures. Production keeps the URL
 * exactly as configured so serverless deployments continue using 6543.
 */
export function databaseUrlForRuntime(rawUrl: string, nodeEnv: string | undefined) {
  if (nodeEnv === "production") return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (
      url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX) &&
      url.port === "6543"
    ) {
      url.port = "5432";
      return url.toString();
    }
  } catch {
    // Let postgres-js report malformed configuration in the usual way.
  }

  return rawUrl;
}

export function isTransactionPoolerUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return (
      url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX) &&
      url.port === "6543"
    );
  } catch {
    return false;
  }
}
