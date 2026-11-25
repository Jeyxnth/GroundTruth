import { ExampleChips } from "@/components/ExampleChips";
import { HomeEntry } from "@/components/HomeEntry";
import { SiteHeader } from "@/components/SiteHeader";
import { DISCLAIMER } from "@/lib/copy";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto grid w-full max-w-[1440px] content-center items-start gap-x-16 gap-y-12 px-4 pb-12 pt-24 sm:px-8 lg:min-h-svh lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="text-5xl leading-[1.04] sm:text-6xl xl:text-7xl">Know what your land was before you buy it.</h1>
          <p className="mt-6 text-xl text-muted">
            Search for a place or drop a pin. GroundTruth reads forty years of satellite images of the plot and shows whether it was ever a lake or
            wetland, when it appears to have been filled, and how low it sits.
          </p>
          <div className="mt-9">
            <HomeEntry />
          </div>
        </div>

        <div className="border-t border-line pt-8 lg:col-span-5 lg:border-t-0 lg:pt-2">
          <ExampleChips />
          <p role="note" className="mt-10 border-t border-line pt-5 text-base text-muted">
            <strong className="text-foreground">Screening tool, not a legal opinion.</strong> {DISCLAIMER}
          </p>
        </div>
      </main>
    </>
  );
}
