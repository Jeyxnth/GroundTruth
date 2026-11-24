"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ElevationCard } from "@/components/ElevationCard";
import { ImageryPanel } from "@/components/ImageryPanel";
import { MapPanel } from "@/components/MapPanel";
import { NextSteps } from "@/components/NextSteps";
import { FactorList, Verdict } from "@/components/RiskCard";
import { SearchBox } from "@/components/SearchBox";
import { SectionCard } from "@/components/Section";
import { SiteHeader } from "@/components/SiteHeader";
import { SummaryCard } from "@/components/SummaryCard";
import { TimelineChart } from "@/components/TimelineChart";
import { WaitPanel } from "@/components/WaitPanel";
import { WaterHistoryCard } from "@/components/WaterHistoryCard";
import type { RiskResult } from "@/lib/analysis/risk";
import { useAnalysis, type Zone } from "@/lib/client/useAnalysis";
import type { Section } from "@/lib/client/useSection";
import { DISCLAIMER, ENTRY, MY_LOCATION_LABEL } from "@/lib/copy";
import { formatCoords, round4, zoneUrl } from "@/lib/geometry";

export { DISCLAIMER };

const noop = () => {};
/** Wrap a locally derived value in the Section shape (loading until it exists). */
function derived<T>(value: T | null): Section<T> {
  return value ? { status: "ok", data: value, notes: [], retry: noop } : { status: "loading", retry: noop };
}

/** Notes about missing years are shown once, inside the chart that has the gaps. The rest are shown here. */
const isGapNote = (n: string) => /year\(s\)/.test(n);

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

  // Pin moves are debounced so a flurry of taps does not fire four Earth Engine requests each.
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
  const notes = a.notes.filter((n) => !isGapNote(n));
  const fromGps = zone.label === MY_LOCATION_LABEL;

  // The printed report has no loading phase, so it keeps the section order but reserves no height.
  const rs = (classes: string) => (report ? classes.split(" ").filter((c) => c.startsWith("order-")).join(" ") : classes);
  const grid = report ? "flex flex-col gap-8" : "flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-x-12";
  const left = report ? "contents" : "contents lg:block lg:sticky lg:top-4 lg:space-y-8";
  const right = report ? "contents" : "contents lg:block lg:space-y-8";

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <header className="mb-8">
          <nav className="no-print mb-4 flex flex-wrap items-center justify-end gap-2" aria-label="Page">
            {report ? (
              <>
                <Link href={zoneUrl("/analyze", zone)} className="btn btn-ghost">
                  Interactive view
                </Link>
                <button type="button" onClick={() => window.print()} className="btn btn-primary">
                  Print / Save as PDF
                </button>
              </>
            ) : (
              <Link href={zoneUrl("/report", zone)} className="btn btn-primary" data-testid="open-report">
                Open report
              </Link>
            )}
          </nav>
          <p className="print-only font-display text-xl font-semibold">GroundTruth · Land history report</p>
          <h1 className="max-w-3xl text-4xl leading-[1.1] sm:text-5xl" data-testid="zone-title">
            {title}
          </h1>
          <p className="mt-2 text-base text-muted">
            <span className="font-mono" translate="no">{formatCoords(zone.lat, zone.lng)}</span> · zone of {zone.radiusM} m radius ·{" "}
            <span suppressHydrationWarning>{report ? `generated ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}` : "live satellite analysis"}</span>
          </p>
          {!report && (
            <details className="no-print mt-3 max-w-2xl">
              <summary className="font-medium text-accent">Check another place</summary>
              <div className="pb-2 pt-1">
                <SearchBox compact onSelect={(p) => relocate(p.lat, p.lng, p.label)} />
              </div>
            </details>
          )}
          <p role="note" className="mt-4 max-w-3xl text-base text-muted" data-testid="disclaimer">
            <strong className="text-foreground">Screening tool, not a legal opinion.</strong> Based on satellite data. Verify with official land records.
          </p>
          {fromGps && (
            <p role="note" className="mt-2 max-w-3xl text-base">
              {ENTRY.locationAccuracy}
            </p>
          )}
          {notes.length > 0 && (
            <ul className="mt-3 max-w-3xl space-y-1 text-base" aria-label="Notes about this location">
              {notes.map((n) => (
                <li key={n} role="note" className="rounded-lg border border-line px-3 py-2">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className={grid}>
          <div className={left}>
            <SectionCard
              id="risk"
              title="Land history check"
              section={derived(risk)}
              reserve={rs("order-1 min-h-[300px]")}
              className="!border-t-0 !pt-0"
              loadingContent={
                <WaitPanel
                  parts={{
                    water: a.water.status,
                    landcover: a.landcover.status,
                    elevation: a.elevation.status,
                    imagery: a.imagery.status,
                  }}
                />
              }
            >
              {(r) => <Verdict risk={r} />}
            </SectionCard>

            <div className="order-5">
              <MapPanel
                lat={zone.lat}
                lng={zone.lng}
                radiusM={zone.radiusM}
                interactive={!report}
                overlay={overlay}
                overlayPending={a.imagery.status === "loading"}
                onMove={onMove}
                height={report ? 300 : 340}
              />
            </div>
          </div>

          <div className={right}>
            <SectionCard
              id="imagery"
              title="Satellite pictures"
              section={a.imagery}
              reserve={rs("order-2 min-h-[790px] lg:min-h-[960px]")}
              className="lg:!border-t-0 lg:!pt-0"
              loadingContent={<div className="skeleton aspect-square w-full max-w-xl" />}
            >
              {(d) => <ImageryPanel data={d} report={report} />}
            </SectionCard>

            <div className="order-3">
              <NextSteps />
            </div>

            <SectionCard id="summary" title="Summary" section={a.summary} reserve={rs("order-4 min-h-[400px] lg:min-h-[280px]")}>
              {(s) => <SummaryCard data={s} />}
            </SectionCard>

            <SectionCard id="timeline" title="What was on the land each year" section={a.landcover} reserve={rs("order-6 min-h-[800px] lg:min-h-[650px]")}>
              {(d) => <TimelineChart landcover={d} water={a.water.status === "ok" ? a.water.data : null} transition={a.transition} />}
            </SectionCard>

            <SectionCard id="water" title="Water record" section={a.water} reserve={rs("order-7 min-h-[620px] lg:min-h-[500px]")}>
              {(d) => <WaterHistoryCard data={d} />}
            </SectionCard>

            <SectionCard id="elevation" title="Ground height" section={a.elevation} reserve={rs("order-8 min-h-[390px] lg:min-h-[290px]")}>
              {(d) => <ElevationCard data={d} />}
            </SectionCard>

            <section className="section order-9 min-h-[64px] border-t border-line pt-5" aria-labelledby="factors-title">
              <h2 id="factors-title" className="sr-only">
                How the score is built
              </h2>
              {risk && <FactorList risk={risk} alwaysOpen={report} />}
            </section>

            <section className="section order-10 border-t border-line pt-5" aria-labelledby="method-title">
              <h2 id="method-title" className="text-2xl">
                About this check
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-muted">
                <li>The zone is a circle of {zone.radiusM} m radius. Each square in the satellite images covers 10 to 30 m, so results describe the whole zone, not single buildings.</li>
                <li>Water record: satellite water maps, 1984 to 2021. Land types: satellite images from January to March each year, cloud removed. Years with no clear image are shown striped, never guessed.</li>
                <li>Land types are decided by a computer model checked against Google Dynamic World land maps, not against the ground.</li>
                <li>Ground height: Copernicus elevation data compared with the land within 1 km.</li>
                <li>The score adds six separate factors. Each one is shown with its points and reason.</li>
              </ul>
              <p className="mt-4 font-medium">{DISCLAIMER}</p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
