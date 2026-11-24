import Link from "next/link";
import { CONTROL_SITES, DEMO_SITES, type Site } from "@/lib/sites";
import { zoneUrl } from "@/lib/geometry";

function Chip({ site }: { site: Site }) {
  return (
    <li>
      <Link
        href={zoneUrl("/analyze", { lat: site.lat, lng: site.lng, label: `${site.name}, ${site.city}` })}
        className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-base hover:bg-panel"
        data-site={site.id}
      >
        <span>
          <span className="font-medium">{site.name}</span>
          <span className="text-muted">, {site.city}</span>
        </span>
      </Link>
    </li>
  );
}

/** One-tap examples: sites built on former water, and land that was never water. */
export function ExampleChips() {
  return (
    <section aria-labelledby="examples-title">
      <h2 id="examples-title" className="text-2xl">
        Try an example
      </h2>
      <p className="mt-3 text-base text-muted">Built on former water, reported in the news:</p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Examples built on former water">
        {DEMO_SITES.map((s) => (
          <Chip key={s.id} site={s} />
        ))}
      </ul>
      <p className="mt-4 text-base text-muted">Land that was never water:</p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Control examples that were never water">
        {CONTROL_SITES.map((s) => (
          <Chip key={s.id} site={s} />
        ))}
      </ul>
    </section>
  );
}
