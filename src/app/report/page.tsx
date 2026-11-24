import type { Metadata } from "next";
import Link from "next/link";
import { AnalysisView } from "@/components/AnalysisView";
import { formatCoords } from "@/lib/geometry";
import { parseZoneParams, type RawSearchParams } from "@/lib/zone-params";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const parsed = parseZoneParams(await searchParams);
  const where = parsed.ok ? (parsed.zone.label ?? formatCoords(parsed.zone.lat, parsed.zone.lng)) : "location";
  return { title: `Land history report: ${where} · GroundTruth`, description: "Satellite-based screening of a plot's water history, land-cover change and risk." };
}

export default async function ReportPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const parsed = parseZoneParams(await searchParams);
  if (!parsed.ok) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold">That location is not valid</h1>
        <p role="alert" className="mt-2">{parsed.message}</p>
        <p className="mt-4"><Link href="/" className="text-accent underline">Back to search</Link></p>
      </main>
    );
  }
  return <AnalysisView key={`${parsed.zone.lat},${parsed.zone.lng}`} initial={parsed.zone} mode="report" />;
}
