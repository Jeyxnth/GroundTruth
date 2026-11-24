"use client";

import { RISK_CONFIG, type RiskBand, type RiskResult } from "@/lib/analysis/risk";

const BAND_COLOR: Record<RiskBand, string> = {
  Low: "var(--band-low)",
  Moderate: "var(--band-moderate)",
  High: "var(--band-high)",
};
const BAND_MEANING: Record<RiskBand, string> = {
  Low: "Little sign that this land was ever water.",
  Moderate: "Some signs of past water or low ground. Worth checking records.",
  High: "Strong signs this land was water and has been filled or sits on low ground. Check records carefully.",
};

/** The 3-second answer: band as text, big score, a scale with the band thresholds, then every factor with its reason. */
export function RiskCard({ risk }: { risk: RiskResult }) {
  const color = BAND_COLOR[risk.band];
  const { moderateMin, highMin } = RISK_CONFIG.bands;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-baseline gap-2" data-testid="risk-score">
          <span className="text-5xl font-bold tabular-nums" style={{ color }}>{risk.score}</span>
          <span className="text-lg text-muted">/ 100</span>
        </div>
        <div>
          <p className="text-2xl font-semibold" style={{ color }} data-testid="risk-band">
            <span aria-hidden>{risk.band === "Low" ? "● " : risk.band === "Moderate" ? "▲ " : "■ "}</span>
            {risk.band} risk
          </p>
          <p className="text-sm text-muted">{BAND_MEANING[risk.band]}</p>
        </div>
      </div>

      <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-panel ring-1 ring-[var(--line)]" aria-hidden>
        <div className="absolute inset-y-0 left-0" style={{ width: `${risk.score}%`, background: color }} />
        {[moderateMin, highMin].map((t) => (
          <div key={t} className="absolute inset-y-0 w-px bg-[var(--foreground)] opacity-60" style={{ left: `${t}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-xs text-muted" aria-hidden>
        <span className="absolute left-0">Low</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(moderateMin + highMin) / 2}%` }}>Moderate</span>
        <span className="absolute right-0">High</span>
      </div>

      {risk.partial && (
        <p role="note" className="mt-3 rounded-md border border-line bg-panel p-2 text-sm">
          Some inputs could not be computed, so this score uses {Math.round(risk.coverage * 100)}% of the scoring factors. It may be too low.
        </p>
      )}

      <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">How the score is built</h3>
      <ul className="mt-2 space-y-3">
        {risk.factors.map((f) => (
          <li key={f.id} className={`rounded-md border p-3 ${f.available ? "border-line" : "border-dashed border-line opacity-80"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{f.name}</span>
              <span className="tabular-nums text-sm">
                {f.available ? `${f.points.toFixed(f.points % 1 ? 1 : 0)} / ${f.maxPoints}` : "unavailable"}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-panel ring-1 ring-[var(--line)]" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${(f.points / f.maxPoints) * 100}%`, background: color }} />
            </div>
            <p className="mt-1.5 text-sm text-muted">{f.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
