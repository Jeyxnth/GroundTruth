"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ElevationCard } from "@/components/ElevationCard";
import { ImageryPanel } from "@/components/ImageryPanel";
import { LazyMap, MapPanel } from "@/components/MapPanel";
import { NextSteps } from "@/components/NextSteps";
import { Reveal } from "@/components/Reveal";
import { FactorList, Verdict } from "@/components/RiskCard";
import { SearchBox } from "@/components/SearchBox";
import { SectionCard } from "@/components/Section";
import { SiteHeader } from "@/components/SiteHeader";
import { SummaryCard } from "@/components/SummaryCard";
import { TimelineChart } from "@/components/TimelineChart";
import { WaitPanel } from "@/components/WaitPanel";
import { WaterHistoryCard } from "@/components/WaterHistoryCard";
import type { RiskBand, RiskResult } from "@/lib/analysis/risk";
import { useAnalysis, type Zone } from "@/lib/client/useAnalysis";
import { useInView } from "@/lib/client/useInView";
import type { Section } from "@/lib/client/useSection";
import { DISCLAIMER, ENTRY, MY_LOCATION_LABEL, describeTransition } from "@/lib/copy";
import { formatCoords, round4, zoneUrl } from "@/lib/geometry";

export { DISCLAIMER };

const noop = () => {};
/** Wrap a locally derived value in the Section shape (loading until it exists). */
function derived<T>(value: T | null): Section<T> {
  return value ? { status: "ok", data: value, notes: [], retry: noop } : { status: "loading", retry: noop };
}

/** Notes about missing years are shown once, inside the chart that has the gaps. The rest are shown here. */
const isGapNote = (n: string) => /year\(s\)/.test(n);

const BAND_VAR: Record<RiskBand, string> = { Low: "var(--band-low)", Moderate: "var(--band-moderate)", High: "var(--band-high)" };

function BandChip({ risk }: { risk: RiskResult }) {
  return (
    <>
      <svg width="14" height="14" viewBox="0 0 28 28" aria-hidden="true" fill={BAND_VAR[risk.band]} className="shrink-0">
        {risk.band === "Low" && <circle cx="14" cy="14" r="11" />}
        {risk.band === "Moderate" && <path d="M14 3 26 25H2z" />}
        {risk.band === "High" && <rect x="3" y="3" width="22" height="22" rx="2" />}
      </svg>
      <span className="truncate">{risk.band} risk</span>
      <span className="text-muted">{risk.score}/100</span>
    </>
  );
}

export function AnalysisView({ initial, mode }: { initial: Zone; mode: "analyze" | "report" }) {
  const report = mode === "report";
  const [zone, setZone] = useState<Zone>(initial);
  const [searchOpen, setSearchOpen] = useState(false);
  const [overlayOn, setOverlayOn] = useState(true);
  const a = useAnalysis(zone);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { ref: heroRef, inView: heroInView } = useInView<HTMLElement>({ once: false, rootMargin: "-56px 0px 0px 0px", threshold: 0.15 });

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
  const rs = (classes: string) => (report ? "" : classes);

  const verdict = (
    <SectionCard
      id="risk"
      title="Land history check"
      titleClass="text-2xl"
      section={derived(risk)}
      reserve={rs("min-h-[300px]")}
      className="!border-t-0 !pt-0"
      loadingContent={<WaitPanel parts={{ water: a.water.status, landcover: a.landcover.status, elevation: a.elevation.status, imagery: a.imagery.status }} />}
    >
      {(r) => <Verdict risk={r} />}
    </SectionCard>
  );

  const chapters: ReactNode = (
    <div className={`mx-auto w-full max-w-5xl space-y-20 px-4 sm:px-6 ${report ? "py-8" : "py-16 sm:py-20"}`}>
      <Reveal>
        <SectionCard id="imagery" title="Then and now" section={a.imagery} reserve={rs("min-h-[640px] lg:min-h-[1000px]")} loadingContent={<div className="skeleton aspect-[3/2] w-full" />}>
          {(d) => <ImageryPanel data={d} report={report} />}
        </SectionCard>
      </Reveal>

      <Reveal>
        <SectionCard id="timeline" title="When it changed" section={a.landcover} reserve={rs("min-h-[840px] lg:min-h-[700px]")}>
          {(d) => (
            <>
              {a.transition && (
                <p className="mb-5 font-display text-2xl leading-snug sm:text-3xl" data-testid="transition">
                  {describeTransition(a.transition)}
                </p>
              )}
              <TimelineChart landcover={d} water={a.water.status === "ok" ? a.water.data : null} transition={a.transition} />
            </>
          )}
        </SectionCard>
      </Reveal>

      <Reveal>
        <SectionCard id="water" title="How often it was water" section={a.water} reserve={rs("min-h-[640px] lg:min-h-[520px]")}>
          {(d) => <WaterHistoryCard data={d} />}
        </SectionCard>
      </Reveal>

      <Reveal>
        <SectionCard id="elevation" title="How low it sits" section={a.elevation} reserve={rs("min-h-[420px] lg:min-h-[320px]")}>
          {(d) => <ElevationCard data={d} />}
        </SectionCard>
      </Reveal>

      <Reveal>
        <SectionCard id="summary" title="In plain words" section={a.summary} reserve={rs("min-h-[380px] lg:min-h-[280px]")}>
          {(s) => <SummaryCard data={s} />}
        </SectionCard>
      </Reveal>

      <Reveal>
        <NextSteps />
      </Reveal>

      <Reveal>
        <section className="section border-t border-line pt-5" aria-labelledby="factors-title">
          <h2 id="factors-title" className="sr-only">
            How the score is built
          </h2>
          <div className="min-h-[64px]">{risk && <FactorList risk={risk} alwaysOpen={report} />}</div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section border-t border-line pt-5" aria-labelledby="method-title">
          <h2 id="method-title" className="text-3xl sm:text-4xl">
            About this check
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-muted">
            <li>The zone is a circle of {zone.radiusM} m radius. Each square in the satellite images covers 10 to 30 m, so results describe the whole zone, not single buildings.</li>
            <li>Water record: satellite water maps, 1984 to 2021. Land types: satellite images from January to March each year, cloud removed. Years with no clear image are shown striped, never guessed.</li>
            <li>Land types are decided by a computer model checked against Google Dynamic World land maps, not against the ground.</li>
            <li>Ground height: Copernicus elevation data compared with the land within 1 km.</li>
            <li>The score adds six separate factors. Each one is shown with its points and reason.</li>
            <li>Imagery: Esri, Maxar, Earthstar Geographics and the GIS User Community. Satellite water maps: European Commission Joint Research Centre and Google.</li>
          </ul>
          <p className="mt-4 font-medium">{DISCLAIMER}</p>
        </section>
      </Reveal>
    </div>
  );

  const noteList = (notes.length > 0 || fromGps) && (
    <div className="mx-auto w-full max-w-5xl space-y-2 px-4 pt-6 text-base sm:px-6">
      {fromGps && (
        <p role="note" className="rounded-lg border border-line px-3 py-2">
          {ENTRY.locationAccuracy}
        </p>
      )}
      {notes.map((n) => (
        <p key={n} role="note" className="rounded-lg border border-line px-3 py-2">
          {n}
        </p>
      ))}
    </div>
  );

  if (report) {
    return (
      <>
        <SiteHeader>
          <Link href={zoneUrl("/analyze", zone)} className="btn btn-ghost">
            Interactive view
          </Link>
          <button type="button" onClick={() => window.print()} className="btn btn-primary">
            Print / Save as PDF
          </button>
        </SiteHeader>
        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 sm:px-6 print:pt-0">
          <p className="print-only font-display text-xl font-semibold">GroundTruth · Land history report</p>
          <h1 className="max-w-3xl text-4xl leading-[1.1] sm:text-5xl" data-testid="zone-title">
            {title}
          </h1>
          <p className="mt-2 text-base text-muted">
            <span className="font-mono" translate="no">{formatCoords(zone.lat, zone.lng)}</span> · zone of {zone.radiusM} m radius ·{" "}
            <span suppressHydrationWarning>generated {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</span>
          </p>
          <p role="note" className="mt-4 text-base text-muted" data-testid="disclaimer">
            <strong className="text-foreground">Screening tool, not a legal opinion.</strong> Based on satellite data. Verify with official land records.
          </p>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-5">{verdict}</div>
          <div className="mt-8">
            <MapPanel lat={zone.lat} lng={zone.lng} radiusM={zone.radiusM} interactive={false} overlay={overlay} overlayPending={a.imagery.status === "loading"} height={300} />
          </div>
        </main>
        {noteList}
        {chapters}
      </>
    );
  }

  return (
    <>
      <SiteHeader overHero progress showChip={!heroInView} chip={risk ? <BandChip risk={risk} /> : undefined}>
        <Link href={zoneUrl("/report", zone)} className="btn btn-header" data-testid="open-report">
          <span className="sm:hidden">Report</span>
          <span className="hidden sm:inline">Open report</span>
        </Link>
      </SiteHeader>

      <main id="main">
        <section ref={heroRef} id="hero" className="hero" aria-label="This place today">
          <div className="absolute inset-0">
            <LazyMap
              lat={zone.lat}
              lng={zone.lng}
              radiusM={zone.radiusM}
              interactive
              overlay={overlay ? { tileUrl: overlay.tileUrl } : null}
              showOverlay={overlayOn}
              onMove={onMove}
              zoom={16.4}
              intro
            />
          </div>
          <div className="hero-scrim-top" aria-hidden />

          <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-6xl px-4 pt-[calc(var(--header-h)+18px)] sm:px-6">
            <h1 className="pointer-events-auto max-w-3xl text-4xl leading-[1.05] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] sm:text-6xl" data-testid="zone-title">
              {title}
            </h1>
            <p className="mt-2 text-base text-white/85">
              <span className="font-mono" translate="no">{formatCoords(zone.lat, zone.lng)}</span> · zone of {zone.radiusM} m radius
            </p>
            <p role="note" className="mt-1 text-base text-white/80" data-testid="disclaimer">
              <strong className="text-white">Screening tool, not a legal opinion.</strong> Based on satellite data. Verify with official land records.
            </p>
            <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-float" aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
                Check another place
              </button>
              <button type="button" className="btn btn-float" aria-pressed={overlayOn} disabled={!overlay} onClick={() => setOverlayOn((v) => !v)}>
                {overlay ? (overlayOn ? "Water record: on" : "Water record: off") : "Water record loading…"}
              </button>
            </div>
            {searchOpen && (
              <div className="pointer-events-auto mt-3 max-w-xl rounded-xl bg-surface p-3 text-foreground shadow-2xl fade-in">
                <SearchBox
                  compact
                  onSelect={(p) => {
                    relocate(p.lat, p.lng, p.label);
                    setSearchOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 lg:bottom-6 lg:left-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:right-auto lg:w-[28rem]">
            <div className="hero-sheet sheet-in pointer-events-auto rounded-t-2xl p-5 pb-6 lg:rounded-2xl">
              {verdict}
              <p className="mt-3 text-sm text-muted">Tap the map or drag the pin to check another spot. Imagery © Esri, Maxar, Earthstar Geographics. Water record: EC JRC and Google.</p>
            </div>
          </div>
        </section>

        {noteList}
        {chapters}
      </main>
    </>
  );
}
