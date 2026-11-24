"use client";

import { useEffect, useState } from "react";
import { RISK_CONFIG, type RiskBand, type RiskResult } from "@/lib/analysis/risk";
import { PARTIAL_RESULT, VERDICT_REASON } from "@/lib/copy";

const BAND_COLOR: Record<RiskBand, string> = { Low: "var(--band-low)", Moderate: "var(--band-moderate)", High: "var(--band-high)" };

/** Band shape drawn as SVG (circle, triangle, square) so the band is never colour alone. */
function BandShape({ band }: { band: RiskBand }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0" fill="currentColor">
      {band === "Low" && <circle cx="14" cy="14" r="11" />}
      {band === "Moderate" && <path d="M14 3 26 25H2z" />}
      {band === "High" && <rect x="3" y="3" width="22" height="22" rx="2" />}
    </svg>
  );
}

/** Counts up once to the target. Instant for reduced motion. */
function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** The 3-second answer: the band as a word and shape, one sentence of why, then the score on its scale. */
export function Verdict({ risk }: { risk: RiskResult }) {
  const color = BAND_COLOR[risk.band];
  const shown = useCountUp(risk.score);
  const { moderateMin, highMin } = RISK_CONFIG.bands;
  return (
    <div className="verdict-in">
      <p className="flex items-center gap-3 font-display text-5xl leading-none sm:text-6xl" style={{ color }} data-testid="risk-band">
        <BandShape band={risk.band} />
        <span>{risk.band} risk</span>
      </p>
      <p className="mt-4 max-w-prose text-lg leading-snug">{VERDICT_REASON[risk.band]}</p>

      <div className="mt-5 flex items-baseline gap-2" data-testid="risk-score">
        <span className="text-2xl font-semibold tabular-nums">{shown}</span>
        <span className="text-muted">out of 100</span>
      </div>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-panel" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${shown}%`, background: color }} />
        {[moderateMin, highMin].map((t) => (
          <div key={t} className="absolute inset-y-0 w-px bg-foreground opacity-50" style={{ left: `${t}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-5 text-sm text-muted" aria-hidden>
        <span className="absolute left-0">Low</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(moderateMin + highMin) / 2}%` }}>Moderate</span>
        <span className="absolute right-0">High</span>
      </div>

      {risk.partial && (
        <p role="note" className="mt-3 rounded-lg border border-line bg-panel p-3 text-base">
          {PARTIAL_RESULT}
        </p>
      )}
    </div>
  );
}

/** Every factor with its points and reason. Collapsed on screen by default; always open in the report. */
export function FactorList({ risk, open = false, alwaysOpen = false }: { risk: RiskResult; open?: boolean; alwaysOpen?: boolean }) {
  const color = BAND_COLOR[risk.band];
  const list = (
    <ul className="mt-2 space-y-4">
      {risk.factors.map((f) => (
        <li key={f.id} className={f.available ? "" : "opacity-80"}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{f.name}</span>
            <span className="tabular-nums text-base text-muted">{f.available ? `${f.points.toFixed(f.points % 1 ? 1 : 0)} of ${f.maxPoints}` : "not available"}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-panel" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${(f.points / f.maxPoints) * 100}%`, background: color }} />
          </div>
          <p className="mt-1.5 text-base text-muted">{f.reason}</p>
        </li>
      ))}
    </ul>
  );
  if (alwaysOpen) return <div>{list}</div>;
  return (
    <details open={open}>
      <summary className="font-medium text-accent">How the score is built</summary>
      {list}
    </details>
  );
}
