import { ExampleChips } from "@/components/ExampleChips";
import { HomeEntry } from "@/components/HomeEntry";
import { SiteHeader } from "@/components/SiteHeader";
import { DISCLAIMER } from "@/lib/copy";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <h1 className="text-5xl leading-[1.05] sm:text-6xl">Know what your land was before you buy it.</h1>
        <p className="mt-5 max-w-prose text-lg text-muted">
          Search for a place or drop a pin. GroundTruth reads forty years of satellite images of the plot and shows whether it was ever a lake or
          wetland, when it appears to have been filled, and how low it sits.
        </p>

        <div className="mt-9">
          <HomeEntry />
        </div>

        <div className="mt-14 border-t border-line pt-8">
          <ExampleChips />
        </div>

        <p role="note" className="mt-14 border-t border-line pt-5 text-base text-muted">
          <strong className="text-foreground">Screening tool, not a legal opinion.</strong> {DISCLAIMER}
        </p>
      </main>
    </>
  );
}
