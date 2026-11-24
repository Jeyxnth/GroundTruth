"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ImageryFrame } from "@/lib/ee/imagery";
import type { ImageryPayload } from "@/lib/client/useAnalysis";

const sensorName = (s: ImageryFrame["sensor"]) => (s === "sentinel2" ? "Sentinel-2" : "Landsat");
const FRAME_MS = 600;

function Img({ f, alt, className = "" }: { f: ImageryFrame; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={f.url} alt={alt} width={132} height={132} decoding="async" className={`absolute inset-0 h-full w-full object-cover ${className}`} draggable={false} />;
}

function BeforeAfter({ before, after, report }: { before: ImageryFrame; after: ImageryFrame; report: boolean }) {
  const [pos, setPos] = useState(50); // % of the frame that shows "before"
  const id = useId();
  if (report) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[before, after].map((f, i) => (
          <figure key={f.year}>
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line bg-panel">
              <Img f={f} alt={`${i === 0 ? "Earliest" : "Latest"} clear satellite image, ${f.year}`} />
            </div>
            <figcaption className="mt-1 text-base">
              {i === 0 ? "Before" : "After"}: <span className="font-mono">{f.year}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="relative aspect-square w-full touch-pan-y select-none overflow-hidden rounded-lg border border-line bg-panel">
        <Img f={after} alt={`Latest clear satellite image, ${after.year}`} />
        {/* The before image is clipped to the slider position (direct manipulation: no easing on the clip). */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Img f={before} alt={`Earliest clear satellite image, ${before.year}`} />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${pos}%` }} aria-hidden />
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-sm font-medium text-white">Before · <span className="font-mono">{before.year}</span></span>
        <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-sm font-medium text-white">After · <span className="font-mono">{after.year}</span></span>
      </div>
      <label htmlFor={id} className="block">
        <span className="sr-only">Compare before and after</span>
        <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-valuetext={`${pos}% showing ${before.year}`} />
      </label>
      <p className="text-base text-muted">
        Drag to compare {before.year} ({sensorName(before.sensor)}) with {after.year} ({sensorName(after.sensor)}). Older images are softer because each square covers 30 m.
      </p>
    </div>
  );
}

function TimeLapse({ frames, gifUrl }: { frames: ImageryFrame[]; gifUrl: string | null }) {
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const preloaded = useRef(false);
  const id = useId();

  const go = (n: number) => {
    setPrev(idx);
    setIdx(n);
  };
  // Preload every frame the first time the user interacts so playback does not stall.
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
    const t = setInterval(() => {
      setIdx((i) => {
        setPrev(i);
        return (i + 1) % frames.length;
      });
    }, FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const f = frames[Math.min(idx, frames.length - 1)]!;
  const p = frames[Math.min(prev, frames.length - 1)]!;
  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line bg-panel">
        {/* Previous frame stays underneath while the new one fades in, so frames dissolve instead of cutting. */}
        <Img f={p} alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={f.year}
          src={f.url}
          alt={`Satellite view of the zone in ${f.year}`}
          width={132}
          height={132}
          decoding="async"
          className="fade-in absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 font-mono text-base font-semibold text-white">{f.year}</span>
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-sm text-white">{sensorName(f.sensor)}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={playing}
          onClick={() => {
            preload();
            setPlaying((v) => !v);
          }}
          className="btn btn-primary w-28 shrink-0"
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
              go(Number(e.target.value));
            }}
            aria-valuetext={`${f.year}`}
          />
        </label>
      </div>
      <p className="text-base text-muted">
        Clear years from <span className="font-mono">{frames[0]!.year}</span> to <span className="font-mono">{frames[frames.length - 1]!.year}</span>.{loaded ? "" : " Press play to load all frames."}{" "}
        {gifUrl && (
          <a href={gifUrl} target="_blank" rel="noreferrer" className="tap -my-3 inline-flex text-accent underline">
            Open as animated GIF
          </a>
        )}
      </p>
    </div>
  );
}

/** Before/after and time-lapse share one square (tabs), so the evidence stays short on a phone. */
export function ImageryPanel({ data, report = false }: { data: ImageryPayload; report?: boolean }) {
  const [tab, setTab] = useState<"compare" | "lapse">("compare");
  const tabsId = useId();
  if (!data.before || !data.after) {
    return <p>Not enough clear satellite years to show a before and after for this zone.</p>;
  }
  const tabs: Array<["compare" | "lapse", string]> = [["compare", "Before and after"], ["lapse", "Time-lapse"]];
  return (
    <div>
      {!report && (
        <div role="tablist" aria-label="Satellite views" className="mb-3 inline-flex rounded-lg border border-line bg-panel p-1">
          {tabs.map(([key, name]) => (
            <button
              key={key}
              role="tab"
              id={`${tabsId}-${key}`}
              aria-selected={tab === key}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") setTab(tab === "compare" ? "lapse" : "compare");
              }}
              className={`tap rounded-md px-4 text-base font-medium transition-colors ${tab === key ? "bg-background shadow-sm" : "text-muted"}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div role={report ? undefined : "tabpanel"} id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
        {report || tab === "compare" ? (
          <BeforeAfter before={data.before} after={data.after} report={report} />
        ) : (
          <TimeLapse frames={data.frames} gifUrl={data.gifError ? null : data.gifUrl} />
        )}
      </div>
      <p className="mt-3 text-base text-muted">
        {data.note}
        {data.skippedYears.length > 0 && ` Years with no clear image: ${data.skippedYears.join(", ")}.`}
      </p>
    </div>
  );
}
