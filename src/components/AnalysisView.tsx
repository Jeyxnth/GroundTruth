"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ElevationCard } from "@/components/ElevationCard";
import { ImageryPanel } from "@/components/ImageryPanel";
import { MapPanel } from "@/components/MapPanel";
import { RiskCard } from "@/components/RiskCard";
import { SearchBox } from "@/components/SearchBox";
import { SectionCard } from "@/components/Section";
import { SummaryCard } from "@/components/SummaryCard";
import { TimelineChart } from "@/components/TimelineChart";
import { WaterHistoryCard } from "@/components/WaterHistoryCard";
import type { RiskResult } from "@/lib/analysis/risk";
import { useAnalysis, type Zone } from "@/lib/client/useAnalysis";
import type { Section } from "@/lib/client/useSection";
import { formatCoords, round4, zoneUrl } from "@/lib/geometry";

export const DISCLAIMER =
  "GroundTruth is a screening tool based on satellite data. It is not a legal or survey determination. Always verify with official land records.";

const noop = () => {};
/** Wrap a locally derived value in the Section shape (loading until it exists). */
function derived<T>(value: T | null): Section<T> {
  return value ? { status: "ok", data: value, notes: [], retry: noop } : { status: "loading", retry: noop };
}

export function AnalysisView({ initial, mode }: { initial: Zone; mode: "analyze" | "report" }) {
  const report = mode === "report";
  const [zone, setZone] = useState<Zone>(initial);
  const a = useAnalysis(zone);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the address bar a stable, shareable link to the current zone.
  useEffect(() => {
    window.history.replaceState(null, "", zoneUrl(report ? "/report" : "/analyze", zone));
    document.title = `${zone.label ?? formatCoords(zone.lat, zone.lng)} · GroundTruth`;
  }, [zone, report]);

  const relocate = useCallback((lat: number, lng: number, label: string | null) => {
    const next = { lat: round4(lat), lng: round4(lng) };
    setZone((z) => (z.lat === next.lat && z.lng === next.lng ? z : { ...z, ...next, label }));
  }, []);

  // Pin moves are debounced so a flurry of clicks does not fire four Earth Engine requests each.
  const onMove = useCallback(
    (lat: number, lng: number) => {
      clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => relocate(lat, lng, null), 450);
    },
    [relocate],
  );
  useEffect(() => () => clearTimeout(moveTimer.current), []);

  const title = zone.label ?? `Pin at ${formatCoords(zone.lat, zone.lng)}`;
  const risk: RiskResult | null = a.risk;
  const overlay = a.imagery.status === "ok" ? a.imagery.data.overlay : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
      <header className="mb-4">
        <nav className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Page">
          <Link href="/" className="font-semibold text-accent">← GroundTruth</Link>
          {report ? (
            <div className="flex gap-2">
              <Link href={zoneUrl("/analyze", zone)} className="rounded-md border border-line px-3 py-1.5">Interactive view</Link>
              <button type="button" onClick={() => window.print()} className="rounded-md bg-accent px-3 py-1.5 font-medium text-[var(--accent-ink)]">
                Print / Save as PDF
              </button>
            </div>
          ) : (
            <Link href={zoneUrl("/report", zone)} className="rounded-md bg-accent px-3 py-1.5 font-medium text-[var(--accent-ink)]" data-testid="open-report">
              Open report
            </Link>
          )}
        </nav>
        <p className="print-only text-lg font-bold">GroundTruth · Land history report</p>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl" data-testid="zone-title">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {formatCoords(zone.lat, zone.lng)} · analysed zone: {zone.radiusM} m radius ·{" "}
          <span suppressHydrationWarning>{report ? `generated ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}` : "live satellite analysis"}</span>
        </p>
        {!report && (
          <div className="no-print mt-4">
            <SearchBox compact onSelect={(p) => relocate(p.lat, p.lng, p.label)} />
          </div>
        )}
        <p role="note" className="mt-3 text-sm text-muted" data-testid="disclaimer">
          <strong className="text-foreground">Screening tool, not a legal opinion.</strong> Based on satellite data. Verify with official land records.
        </p>
      </header>

      <div className="space-y-4">
        <SectionCard id="risk" title="Risk screening" section={derived(risk)} minHeight={420}>
          {(r) => <RiskCard risk={r} />}
        </SectionCard>

        <SectionCard id="summary" title="Summary" section={a.summary} minHeight={150}>
          {(s) => <SummaryCard data={s} />}
        </SectionCard>

        {a.notes.length > 0 && (
          <ul className="space-y-1 text-sm" aria-label="Notes about this location">
            {a.notes.map((n) => (
              <li key={n} role="note" className="rounded-md border border-line px-3 py-2">{n}</li>
            ))}
          </ul>
        )}

        <MapPanel
          lat={zone.lat}
          lng={zone.lng}
          radiusM={zone.radiusM}
          interactive={!report}
          overlay={overlay}
          overlayPending={a.imagery.status === "loading"}
          onMove={onMove}
          height={report ? 320 : 400}
        />

        <SectionCard id="imagery" title="Satellite imagery" section={a.imagery} minHeight={560}>
          {(d) => <ImageryPanel data={d} report={report} />}
        </SectionCard>

        <SectionCard id="timeline" title="Land cover, year by year" section={a.landcover} minHeight={460}>
          {(d) => <TimelineChart landcover={d} water={a.water.status === "ok" ? a.water.data : null} transition={a.transition} />}
        </SectionCard>

        <SectionCard id="water" title="Water history" section={a.water} minHeight={380}>
          {(d) => <WaterHistoryCard data={d} />}
        </SectionCard>

        <SectionCard id="elevation" title="Elevation context" section={a.elevation} minHeight={280}>
          {(d) => <ElevationCard data={d} />}
        </SectionCard>

        <section className="section rounded-lg border border-line bg-background p-4 text-sm sm:p-5" aria-labelledby="method-title">
          <h2 id="method-title" className="text-lg font-semibold">About this analysis</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
            <li>Zone: a {zone.radiusM} m radius around the point. Satellite pixels are 10 to 30 m, so results are shares of the zone, not individual buildings.</li>
            <li>Water history: JRC Global Surface Water v1.4 (1984 to 2021). Land cover: Landsat 5/7/8/9 (to 2016) and Sentinel-2 (from 2017), January to March each year, cloud-masked median.</li>
            <li>Land-cover classes come from a Random Forest trained on Dynamic World labels. Its accuracy is measured against those labels, not the ground. Years without cloud-free imagery are shown as gaps, never filled in.</li>
            <li>Elevation: Copernicus DEM GLO-30 compared with the surrounding 1 km.</li>
            <li>The risk score adds six separate factors; each is shown above with its points and reason.</li>
          </ul>
          <p className="mt-3 font-medium">{DISCLAIMER}</p>
        </section>
      </div>
    </main>
  );
}
