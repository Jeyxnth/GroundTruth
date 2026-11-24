"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ImageryFrame } from "@/lib/ee/imagery";
import type { ImageryPayload } from "@/lib/client/useAnalysis";

const sensorName = (s: ImageryFrame["sensor"]) => (s === "sentinel2" ? "Sentinel-2" : "Landsat");
const FRAME_MS = 600;

function BeforeAfter({ before, after, report }: { before: ImageryFrame; after: ImageryFrame; report: boolean }) {
  const [pos, setPos] = useState(50); // % of the frame showing "before"
  const id = useId();
  if (report) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[before, after].map((f, i) => (
          <figure key={f.year}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={`${i === 0 ? "Earliest" : "Latest"} clear satellite image, ${f.year}`} className="aspect-square w-full rounded-md border border-line object-cover" />
            <figcaption className="mt-1 text-sm">{i === 0 ? "Before" : "After"}: {f.year} ({sensorName(f.sensor)})</figcaption>
          </figure>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-xl select-none overflow-hidden rounded-md border border-line bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after.url} alt={`Latest clear satellite image, ${after.year}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before.url}
          alt={`Earliest clear satellite image, ${before.year}`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} aria-hidden />
        <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-xs font-medium text-white">Before · {before.year}</span>
        <span className="absolute right-2 top-2 rounded bg-black/65 px-2 py-0.5 text-xs font-medium text-white">After · {after.year}</span>
      </div>
      <label htmlFor={id} className="mx-auto mt-3 block max-w-xl text-sm">
        <span className="sr-only">Compare before and after</span>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="w-full"
          aria-valuetext={`${pos}% showing ${before.year}`}
        />
      </label>
      <p className="mx-auto max-w-xl text-center text-xs text-muted">
        Drag to compare {before.year} ({sensorName(before.sensor)}) with {after.year} ({sensorName(after.sensor)}). Older Landsat images are softer because each pixel is 30 m.
      </p>
    </div>
  );
}

function TimeLapse({ frames, gifUrl }: { frames: ImageryFrame[]; gifUrl: string | null }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const preloaded = useRef(false);
  const id = useId();

  // Preload frames the first time the user interacts, so playback does not stall.
  const preload = () => {
    if (preloaded.current) return;
    preloaded.current = true;
    let done = 0;
    frames.forEach((f) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        done += 1;
        if (done === frames.length) setLoaded(true);
      };
      img.src = f.url;
    });
  };

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const f = frames[Math.min(idx, frames.length - 1)]!;
  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-md border border-line bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.url} alt={`Satellite view of the zone in ${f.year}`} loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-sm font-semibold text-white tabular-nums">{f.year}</span>
        <span className="absolute bottom-2 left-2 rounded bg-black/65 px-2 py-0.5 text-xs text-white">{sensorName(f.sensor)}</span>
      </div>
      <div className="mx-auto mt-3 flex max-w-xl items-center gap-3">
        <button
          type="button"
          aria-pressed={playing}
          onClick={() => {
            preload();
            setPlaying((p) => !p);
          }}
          className="w-24 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-[var(--accent-ink)]"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <label htmlFor={id} className="flex-1">
          <span className="sr-only">Year</span>
          <input
            id={id}
            type="range"
            min={0}
            max={frames.length - 1}
            value={idx}
            onChange={(e) => {
              preload();
              setPlaying(false);
              setIdx(Number(e.target.value));
            }}
            className="w-full"
            aria-valuetext={`${f.year}`}
          />
        </label>
      </div>
      <p className="mx-auto mt-1 max-w-xl text-xs text-muted">
        {frames.length} clear years from {frames[0]!.year} to {frames[frames.length - 1]!.year}.{loaded ? "" : " Press play to load all frames."}{" "}
        {gifUrl && (
          <a href={gifUrl} target="_blank" rel="noreferrer" className="text-accent underline">
            Open as animated GIF
          </a>
        )}
      </p>
    </div>
  );
}

export function ImageryPanel({ data, report = false }: { data: ImageryPayload; report?: boolean }) {
  if (!data.before || !data.after) {
    return <p className="text-sm">Not enough clear satellite years to show a before and after for this zone.</p>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Before and after</h3>
        <BeforeAfter before={data.before} after={data.after} report={report} />
      </div>
      {!report && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Time-lapse</h3>
          <TimeLapse frames={data.frames} gifUrl={data.gifError ? null : data.gifUrl} />
        </div>
      )}
      <p className="text-xs text-muted">
        {data.note}
        {data.skippedYears.length > 0 && ` Skipped for lack of clear imagery: ${data.skippedYears.join(", ")}.`}
      </p>
    </div>
  );
}
