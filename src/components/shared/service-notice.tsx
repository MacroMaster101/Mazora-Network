import { supportEmail, supportMailto } from "@/lib/support-contact";

/**
 * The outage notice, shown by the root layout while the database is down.
 *
 * Plain wording for visitors: it says what to expect and where to write, never
 * why it failed (no error codes, provider names or limits). A server component
 * with no script, so it costs nothing on the pages it is not shown on.
 */
export function ServiceNotice() {
  return (
    <div className="service-notice" role="status">
      <p>
        <strong>Some of Mazora is temporarily unavailable.</strong>{" "}
        Player stats, the store, forums and sign-in may not load for a while. Your account and progress are safe.
        {supportEmail && (
          <>
            {" "}Need help now? Email <a href={supportMailto(supportEmail)}>{supportEmail}</a>.
          </>
        )}
      </p>
    </div>
  );
}
