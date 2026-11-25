import type { ImageryPayload } from "@/lib/client/useAnalysis";

/**
 * Past high-resolution imagery from Esri's World Imagery archive (Wayback). The number is the archive release; the photo
 * in it may be older than the release year, never newer.
 */
export const ARCHIVE = [
  { year: 2014, release: 5844 },
  { year: 2018, release: 23448 },
  { year: 2022, release: 45134 },
] as const;

const Z = 17; // about 1.1 m per pixel: buildings and roads are easy to pick out
const tileX = (lng: number) => ((lng + 180) / 360) * 2 ** Z;
const tileY = (lat: number) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z;

/** The archive tiles covering the frame, placed so they line up exactly with the other pictures of the same frame. */
export function ArchiveTiles({ release, bounds, alt }: { release: number; bounds: ImageryPayload["frameBounds"]; alt: string }) {
  const x0 = tileX(bounds.west);
  const x1 = tileX(bounds.east);
  const y0 = tileY(bounds.north);
  const y1 = tileY(bounds.south);
  const tiles: Array<{ x: number; y: number }> = [];
  for (let y = Math.floor(y0); y <= Math.floor(y1); y++) for (let x = Math.floor(x0); x <= Math.floor(x1); x++) tiles.push({ x, y });
  return (
    <div role="img" aria-label={alt} className="absolute inset-0 overflow-hidden">
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${release}/${t.x}/${t.y}`}
          src={`https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/${Z}/${t.y}/${t.x}`}
          alt=""
          decoding="async"
          draggable={false}
          className="absolute max-w-none"
          style={{
            left: `${((t.x - x0) / (x1 - x0)) * 100}%`,
            top: `${((t.y - y0) / (y1 - y0)) * 100}%`,
            width: `${100 / (x1 - x0) + 0.15}%`,
            height: `${100 / (y1 - y0) + 0.15}%`,
          }}
        />
      ))}
    </div>
  );
}
