"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ImageryFrame } from "@/lib/ee/imagery";
import type { ImageryPayload } from "@/lib/client/useAnalysis";
import { prefersReducedMotion, useInView } from "@/lib/client/useInView";

const sensorName = (s: ImageryFrame["sensor"]) => (s === "sentinel2" ? "Sentinel-2" : "Landsat");
const FRAME_MS = 600;
const FRAME_W = 720;
const FRAME_H = 480;

/** Today's picture: Esri's recent high-resolution imagery for the same frame, so buildings and roads are readable. */
function todayUrl(b: ImageryPayload["frameBounds"]): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${b.west},${b.south},${b.east},${b.north}&bboxSR=4326&imageSR=3857&size=960,640&format=jpg&f=image`;
}

/** The analysed zone, drawn crisply over a picture at its true size. */
function Ring({ fraction }: { fraction: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(0,0,0,0.25)]"
      style={{ width: `${fraction * 100}%`, aspectRatio: "1 / 1" }}
    />
  );
}

function Pic({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={FRAME_W} height={FRAME_H} decoding="async" loading={eager ? "eager" : "lazy"} className={`absolute inset-0 h-full w-full object-cover ${className}`} draggable={false} />;
}

function Tag({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return <span className={`absolute top-2 ${side === "left" ? "left-2" : "right-2"} rounded-md bg-black/70 px-2.5 py-1 text-sm font-medium text-white`}>{children}</span>;
}

function BeforeAfter({ before, data, report }: { before: ImageryFrame; data: ImageryPayload; report: boolean }) {
  const [pos, setPos] = useState(report ? 50 : 96); // % of the frame that shows "before"
  const touched = useRef(false);
  const id = useId();
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "0px 0px -15% 0px" });
  const after = todayUrl(data.frameBounds);

  // One sweep when the slider first scrolls into view, to show it can be dragged. Skipped if the user already touched it.
  useEffect(() => {
    if (report || !inView || prefersReducedMotion()) {
      const id0 = requestAnimationFrame(() => !touched.current && inView && setPos(50));
      return () => cancelAnimationFrame(id0);
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (touched.current) return;
      const t = Math.min(1, (now - start) / 1300);
      setPos(Math.round(96 - 46 * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, report]);

  if (report) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { src: before.url, label: `Before: ${before.year}`, alt: `Earliest clear satellite image, ${before.year}` },
          { src: after, label: "Today", alt: "Recent high-resolution satellite image" },
        ].map((p) => (
          <figure key={p.label}>
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-line bg-panel">
              <Pic src={p.src} alt={p.alt} eager />
              <Ring fraction={data.ringFraction} />
            </div>
            <figcaption className="mt-1 text-base">{p.label}</figcaption>
          </figure>
        ))}
      </div>
    );
  }
  return (
    <div ref={ref}>
      <div className="relative aspect-[3/2] w-full touch-pan-y select-none overflow-hidden rounded-xl border border-line bg-panel">
        <Pic src={after} alt="Recent high-resolution satellite image of the zone" />
        {/* The before picture is clipped to the slider position: direct manipulation, so the clip itself is not eased. */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Pic src={before.url} alt={`Earliest clear satellite image, ${before.year}`} />
        </div>
        <Ring fraction={data.ringFraction} />
        <div className="pointer-events-none absolute inset-y-0 flex w-0.5 items-center bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${pos}%` }} aria-hidden>
          <span className="-ml-3.5 grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-md">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" />
            </svg>
          </span>
        </div>
        <Tag side="left">Before · <span className="font-mono">{before.year}</span></Tag>
        <Tag side="right">Today</Tag>
      </div>
      <label htmlFor={id} className="block">
        <span className="sr-only">Compare before and today</span>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => {
            touched.current = true;
            setPos(Number(e.target.value));
          }}
          aria-valuetext={`${pos}% showing ${before.year}`}
        />
      </label>
      <p className="text-base text-muted">
        {before.year} is Landsat ({sensorName(before.sensor) === "Landsat" ? "each visible square is 30 m across, the finest detail that satellite recorded" : "10 m squares"}). Today is Esri high-resolution imagery (Maxar and others), dated within the last few years.
      </p>
    </div>
  );
}

function TimeLapse({ frames, gifUrl, ring }: { frames: ImageryFrame[]; gifUrl: string | null; ring: number }) {
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const preloaded = useRef(false);
  const id = useId();

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
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-line bg-panel">
        {/* The previous frame stays underneath while the new one fades in, so frames dissolve instead of cutting. */}
        <Pic src={p.url} alt="" eager />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={f.year} src={f.url} alt={`Satellite view of the zone in ${f.year}`} width={FRAME_W} height={FRAME_H} decoding="async" className="fade-in absolute inset-0 h-full w-full object-cover" draggable={false} />
        <Ring fraction={ring} />
        <Tag side="left"><span className="font-mono text-base font-semibold">{f.year}</span></Tag>
        <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2.5 py-1 text-sm text-white">{sensorName(f.sensor)}</span>
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
              setPrev(idx);
              setIdx(Number(e.target.value));
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

/** Before-and-after and time-lapse share one frame (tabs), so the evidence stays short on a phone. */
export function ImageryPanel({ data, report = false }: { data: ImageryPayload; report?: boolean }) {
  const [tab, setTab] = useState<"compare" | "lapse">("compare");
  const tabsId = useId();
  if (!data.before || !data.after) {
    return <p>Not enough clear satellite years to show a before and after for this zone.</p>;
  }
  const tabs: Array<["compare" | "lapse", string]> = [["compare", "Then and now"], ["lapse", "Time-lapse"]];
  return (
    <div>
      {!report && (
        <div role="tablist" aria-label="Satellite views" className="mb-3 inline-flex rounded-xl border border-line bg-panel p-1">
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
              className={`tap rounded-lg px-4 text-base font-medium transition-colors ${tab === key ? "bg-background shadow-sm" : "text-muted"}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div role={report ? undefined : "tabpanel"} id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
        {report || tab === "compare" ? (
          <BeforeAfter before={data.before} data={data} report={report} />
        ) : (
          <TimeLapse frames={data.frames} gifUrl={data.gifError ? null : data.gifUrl} ring={data.ringFraction} />
        )}
      </div>
      <p className="mt-3 text-base text-muted">
        {data.note}
        {data.skippedYears.length > 0 && ` Years with no clear image: ${data.skippedYears.join(", ")}.`}
      </p>
    </div>
  );
}
