"use client";

import { useEffect, useState } from "react";
import { WAIT } from "@/lib/copy";

type Status = "loading" | "ok" | "error";
type Part = keyof typeof WAIT.parts;

const label = (s: Status) => (s === "loading" ? WAIT.status.reading : s === "ok" ? WAIT.status.done : WAIT.status.failed);

/**
 * Shown in place of the verdict while a new place is read. Says what is happening, how long it can take, and which
 * parts are done. Parts that finish are announced to screen readers.
 */
export function WaitPanel({ parts }: { parts: Record<Part, Status> }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const keys = Object.keys(WAIT.parts) as Part[];
  return (
    <div data-testid="wait-panel">
      <p className="font-display text-3xl leading-tight">{WAIT.heading}</p>
      <p className="mt-2 min-h-[3rem] max-w-prose text-base text-muted">{slow ? WAIT.slow : " "}</p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {keys.map((k) => (
          <li key={k} className="flex items-center justify-between gap-3 py-3">
            <span>{WAIT.parts[k]}</span>
            <span className={`flex items-center gap-2 text-base ${parts[k] === "ok" ? "text-[var(--band-low)]" : parts[k] === "error" ? "text-[var(--band-high)]" : "text-muted"}`}>
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${parts[k] === "loading" ? "skeleton" : ""}`} style={parts[k] === "loading" ? undefined : { background: "currentColor" }} />
              {label(parts[k])}
            </span>
          </li>
        ))}
      </ul>
      <div className="sr-only" aria-live="polite">
        {keys.filter((k) => parts[k] === "ok").map((k) => WAIT.ready(WAIT.parts[k])).join(" ")}
      </div>
    </div>
  );
}
