import { ArrowUpRight, CheckCircle2, FileText, XCircle } from "lucide-react";

interface GoogleFormCardProps {
  formUrl: string;
  title: string;
  subtitle?: string;
  description: string;
  bulletPoints?: string[];
  buttonText?: string;
  disabled?: boolean;
}

export function GoogleFormEmbed({
  formUrl,
  title,
  subtitle = "Official Google Form",
  description,
  bulletPoints = [],
  buttonText = "Fill Form on Google",
  disabled = false,
}: GoogleFormCardProps) {
  return (
    <div
      className={`panel rounded-3xl border bg-gradient-to-b from-card/98 to-surface/90 p-7 sm:p-10 shadow-2xl backdrop-blur-xl transition-all ${
        disabled
          ? "border-red-500/30 opacity-80"
          : "border-accent/35 hover:border-accent/50"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-line/80">
        <div className="flex items-start gap-5">
          <div
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border shadow-inner ${
              disabled
                ? "bg-red-500/10 text-red-400 border-red-500/25"
                : "bg-accent/20 text-accent-bright border-accent/40"
            }`}
          >
            {disabled ? <XCircle size={28} /> : <FileText size={28} />}
          </div>
          <div>
            <span
              className={`eyebrow mb-1.5 block font-bold ${
                disabled ? "text-red-400" : "text-accent-bright"
              }`}
            >
              {disabled ? "Intake Paused" : subtitle}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">{title}</h2>
            <p className="mt-2 text-base sm:text-lg text-muted font-medium max-w-2xl leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {disabled ? (
            <span className="py-4 px-8 text-base font-bold flex items-center justify-center gap-3 rounded-xl border border-line bg-surface text-muted cursor-not-allowed select-none opacity-60">
              {buttonText} <XCircle size={20} />
            </span>
          ) : (
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary py-4 px-8 text-base font-bold flex items-center justify-center gap-3 rounded-xl shadow-xl shadow-accent/25 hover:shadow-accent/45 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {buttonText} <ArrowUpRight size={20} />
            </a>
          )}
        </div>
      </div>

      {bulletPoints.length > 0 && (
        <div className={`mt-8 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted mb-4">Before you submit</h4>
          <ul className="grid gap-4 sm:grid-cols-2">
            {bulletPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-3 p-4 rounded-xl border border-line/60 bg-surface/40 text-sm font-medium text-ink transition-colors hover:border-accent/30">
                <CheckCircle2 size={18} className="text-accent-bright shrink-0 mt-0.5" />
                <span className="leading-relaxed">{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

