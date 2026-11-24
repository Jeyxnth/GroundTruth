import { ExampleChips } from "@/components/ExampleChips";
import { HomeSearch } from "@/components/HomeSearch";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">GroundTruth</p>
      <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">Know what your land was before you buy it.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Type an address or drop a pin. GroundTruth reads 40 years of satellite images of a 150 m zone to show whether it was ever a lake or
        wetland, when it was filled, and how low it sits.
      </p>

      <div className="mt-8">
        <HomeSearch />
      </div>

      <div className="mt-10">
        <ExampleChips />
      </div>

      <p role="note" className="mt-12 rounded-md border border-line bg-panel p-3 text-sm">
        <strong>Screening tool, not a legal opinion.</strong> Based on satellite data. It is not a legal or survey determination. Verify with
        official land records before any decision.
      </p>
    </main>
  );
}
