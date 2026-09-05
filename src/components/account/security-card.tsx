import { CheckCircle2, KeyRound, Monitor, ShieldAlert, TriangleAlert } from "lucide-react";
import { methodLabel, type SecurityState, type SignInMethod } from "@/lib/auth/session-security";
import { relative } from "@/lib/utils";

/** Provider tint, so the chips read at a glance rather than by their text. */
const METHOD_TINT: Record<SignInMethod, string> = {
  google: "border-sky-400/30 bg-sky-500/10 text-sky-500",
  discord: "border-violet-400/30 bg-violet-500/10 text-violet-500",
  password: "border-line bg-ink/5 text-ink",
  "magic-link": "border-line bg-ink/5 text-ink",
  unknown: "border-line bg-ink/5 text-muted",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line-strong/40 py-2.5 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <span className="min-w-0 text-sm">{children}</span>
    </div>
  );
}

function MethodChip({ method }: { method: SignInMethod }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${METHOD_TINT[method]}`}>
      {methodLabel(method)}
    </span>
  );
}

/**
 * Real account security state.
 *
 * Replaces two hardcoded strings that were true of any account in any
 * condition. Every line here is derived from the session or the user record.
 *
 * There is deliberately no devices/locations list — see session-security.ts for
 * why that data cannot be trusted in this deployment.
 */
export function SecurityCard({ state }: { state: SecurityState | null }) {
  if (!state) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <Monitor size={16} aria-hidden /> Sign-in details are unavailable right now.
      </div>
    );
  }

  return (
    <div className="grid">
      <Row label="Signed in with">
        <MethodChip method={state.current} />
      </Row>

      <Row label="Ways you can sign in">
        {state.methods.length > 0 ? (
          <span className="flex flex-wrap justify-end gap-1.5">
            {state.methods.map((method) => (
              <MethodChip key={method} method={method} />
            ))}
          </span>
        ) : (
          <span className="text-muted">None recorded</span>
        )}
      </Row>

      <Row label="Email">
        {state.emailConfirmed ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-500">
            <CheckCircle2 size={14} aria-hidden /> Confirmed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-500">
            <TriangleAlert size={14} aria-hidden /> Not confirmed
          </span>
        )}
      </Row>

      {state.lastSignInAt && (
        <Row label="Last sign-in">
          <time dateTime={state.lastSignInAt} className="text-muted">
            {relative(state.lastSignInAt)}
          </time>
        </Row>
      )}

      {/*
        The one line here a member can act on. An account reachable only through
        Google or Discord is lost with that provider, and nothing else on this
        card tells them so.
      */}
      {state.oauthOnly && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-600 dark:text-amber-500">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            You sign in only through a connected provider. Setting a password above gives you a second way in if you
            ever lose access to it.
          </span>
        </p>
      )}

      {!state.oauthOnly && state.methods.includes("password") && (
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <KeyRound size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>Keep your password unique to Mazora — reusing one from another site is how most accounts are lost.</span>
        </p>
      )}
    </div>
  );
}
