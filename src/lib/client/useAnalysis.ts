"use client";

import { useMemo } from "react";
import type { SummaryResult } from "@/lib/llm";
import type { ElevationData } from "@/lib/ee/elevation";
import type { ImageryData, OverlayData } from "@/lib/ee/imagery";
import type { LandcoverData } from "@/lib/ee/landcover";
import type { WaterHistoryData } from "@/lib/ee/water";
import { buildFacts, type Facts } from "@/lib/analysis/facts";
import { computeRisk, type RiskResult } from "@/lib/analysis/risk";
import { detectTransition, type TransitionResult } from "@/lib/analysis/transitions";
import { isWithinIndiaBounds } from "@/lib/geo";
import { useSection, type Section } from "@/lib/client/useSection";

export type ImageryPayload = ImageryData & { overlay: OverlayData | null; overlayError: string | null };

export interface Zone {
  lat: number;
  lng: number;
  radiusM: number;
  label: string | null;
}

export interface Analysis {
  water: Section<WaterHistoryData>;
  landcover: Section<LandcoverData>;
  elevation: Section<ElevationData>;
  imagery: Section<ImageryPayload>;
  summary: Section<SummaryResult>;
  transition: TransitionResult | null;
  risk: RiskResult | null;
  facts: Facts | null;
  notes: string[];
  /** True once water, landcover and elevation have each finished (successfully or not). */
  coreSettled: boolean;
}

const q = (z: Zone) => `lat=${z.lat}&lng=${z.lng}&radius=${z.radiusM}`;

/** Fires all section requests in parallel and derives transition, risk and facts from whatever has arrived. */
export function useAnalysis(zone: Zone): Analysis {
  const water = useSection<WaterHistoryData>(`/api/water-history?${q(zone)}`);
  const landcover = useSection<LandcoverData>(`/api/landcover?${q(zone)}`);
  const elevation = useSection<ElevationData>(`/api/elevation?${q(zone)}`);
  const imagery = useSection<ImageryPayload>(`/api/imagery?${q(zone)}`);

  const waterData = water.status === "ok" ? water.data : null;
  const landData = landcover.status === "ok" ? landcover.data : null;
  const elevData = elevation.status === "ok" ? elevation.data : null;
  const coreSettled = water.status !== "loading" && landcover.status !== "loading" && elevation.status !== "loading";

  const transition = useMemo(() => {
    if (!landData) return null;
    const jrc = new Map((waterData?.yearly ?? []).map((y) => [y.year, y.waterFraction]));
    return detectTransition(landData.years.map((y) => ({ year: y.year, shares: y.shares, jrcWater: jrc.get(y.year) ?? null })));
  }, [landData, waterData]);

  const risk = useMemo(() => {
    if (!coreSettled) return null;
    return computeRisk({
      water: waterData?.summary ?? null,
      transition,
      relativeElevationM: elevData?.relativeElevationM ?? null,
      currentYear: new Date().getFullYear(),
    });
  }, [coreSettled, waterData, transition, elevData]);

  const facts = useMemo(() => {
    if (!coreSettled || !risk) return null;
    return buildFacts({
      label: zone.label,
      inIndia: isWithinIndiaBounds(zone.lat, zone.lng),
      radiusM: zone.radiusM,
      firstYear: landData?.firstYear ?? 1985,
      lastYear: landData?.lastYear ?? new Date().getFullYear(),
      seasonWindow: landData?.season.label ?? "Jan to Mar",
      water: waterData?.summary ?? null,
      transition,
      elevation: elevData ? { relativeElevationM: elevData.relativeElevationM, isLocalDepression: elevData.isLocalDepression } : null,
      risk,
    });
  }, [coreSettled, risk, zone.label, zone.lat, zone.lng, zone.radiusM, landData, waterData, transition, elevData]);

  const factsBody = facts ? JSON.stringify({ facts }) : null;
  const summary = useSection<SummaryResult>(factsBody ? "/api/summary" : null, factsBody ? { method: "POST", body: factsBody } : undefined);

  const notes = useMemo(() => {
    const all = [water, landcover, elevation, imagery].flatMap((s) => (s.status === "ok" ? s.notes : []));
    return [...new Set(all)];
  }, [water, landcover, elevation, imagery]);

  return { water, landcover, elevation, imagery, summary, transition, risk, facts, notes, coreSettled };
}
