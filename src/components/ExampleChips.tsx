import Link from "next/link";
import { CONTROL_SITES, DEMO_SITES, type Site } from "@/lib/sites";
import { zoneUrl } from "@/lib/geometry";

function Chip({ site }: { site: Site }) {
  return (
    <li>
      <Link
        href={zoneUrl("/analyze", { lat: site.lat, lng: site.lng, label: `${site.name}, ${site.city}` })}
        className="block rounded-full border border-line px-3 py-1.5 text-sm hover:bg-panel"
        data-site={site.id}
      >
        <span className="font-medium">{site.name}</span>
        <span className="text-muted"> · {site.city}</span>
      </Link>
    </li>
  );
}

/** One-click examples: sites built on former water, and control sites that were never water. */
export function ExampleChips() {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Try an example</h2>
      <p className="mt-2 text-sm text-muted">Built on former water (reported in the news):</p>
      <ul className="mt-1 flex flex-wrap gap-2" aria-label="Examples built on former water">
        {DEMO_SITES.map((s) => (
          <Chip key={s.id} site={s} />
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">Control sites that were never water:</p>
      <ul className="mt-1 flex flex-wrap gap-2" aria-label="Control examples that were never water">
        {CONTROL_SITES.map((s) => (
          <Chip key={s.id} site={s} />
        ))}
      </ul>
    </div>
  );
}
