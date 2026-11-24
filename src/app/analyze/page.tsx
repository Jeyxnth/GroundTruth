import type { Metadata } from "next";
import Link from "next/link";
import { AnalysisView } from "@/components/AnalysisView";
import { parseZoneParams, type RawSearchParams } from "@/lib/zone-params";

export const metadata: Metadata = { title: "Analysis · GroundTruth" };

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const parsed = parseZoneParams(await searchParams);
  if (!parsed.ok) return <InvalidLocation message={parsed.message} />;
  // key forces a fresh view if the server navigates to a different location
  return <AnalysisView key={`${parsed.zone.lat},${parsed.zone.lng}`} initial={parsed.zone} mode="analyze" />;
}

function InvalidLocation({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">That location is not valid</h1>
      <p role="alert" className="mt-2">{message}</p>
      <p className="mt-4">
        <Link href="/" className="text-accent underline">Back to search</Link>
      </p>
    </main>
  );
}
