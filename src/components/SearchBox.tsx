"use client";

import { useId, useRef, useState } from "react";
import { getJson, SectionError } from "@/lib/client/fetch";
import { formatCoords } from "@/lib/geometry";

export interface Place {
  label: string;
  lat: number;
  lng: number;
  inIndia: boolean;
}

interface GeocodeData {
  results: Array<Place & { type: string | null }>;
}

type State =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "results"; results: Place[] }
  | { status: "error"; message: string; retryable: boolean };

/** Address search (Nominatim via /api/geocode). Also accepts "lat, lng". Submit-only: no search-as-you-type. */
export function SearchBox({
  onSelect,
  compact = false,
  initialQuery = "",
}: {
  onSelect: (p: Place) => void;
  compact?: boolean;
  initialQuery?: string;
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ status: "idle" });
  const abort = useRef<AbortController | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setState({ status: "error", message: "Type at least 3 characters, or paste a lat, lng pair.", retryable: false });
      return;
    }
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setState({ status: "searching" });
    try {
      const { data } = await getJson<GeocodeData>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ac.signal, timeoutMs: 20_000 });
      setState({ status: "results", results: data.results });
    } catch (err) {
      if (ac.signal.aborted) return;
      const e2 = err instanceof SectionError ? err : new SectionError("Search failed.", "bad_response", true);
      setState({ status: "error", message: e2.message, retryable: e2.retryable });
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={search} role="search" className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={inputId} className={compact ? "sr-only" : "mb-1 block text-sm font-medium"}>
            Address, locality or coordinates
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Perungudi, Chennai   or   12.9413, 80.2179"
            autoComplete="off"
            className="w-full rounded-md border border-line bg-background px-3 py-2.5 text-base"
            aria-describedby={`${listId}-status`}
          />
        </div>
        <button
          type="submit"
          className={`rounded-md bg-accent px-4 py-2.5 font-medium text-[var(--accent-ink)] ${compact ? "self-end" : "self-end"}`}
          disabled={state.status === "searching"}
        >
          {state.status === "searching" ? "Searching…" : "Search"}
        </button>
      </form>

      <div id={`${listId}-status`} aria-live="polite" className="mt-2 text-sm">
        {state.status === "searching" && <p className="text-muted">Looking up the address…</p>}
        {state.status === "error" && (
          <p role="alert" className="text-[var(--band-high)]">
            {state.message}{" "}
            {state.retryable && (
              <button type="button" onClick={() => search()} className="underline">
                Try again
              </button>
            )}
          </p>
        )}
        {state.status === "results" && (
          <>
            <p className="text-muted">
              {state.results.length} match{state.results.length === 1 ? "" : "es"}. Choose the right one:
            </p>
            <ul id={listId} className="mt-1 divide-y divide-line rounded-md border border-line">
              {state.results.map((r, i) => (
                <li key={`${r.lat},${r.lng},${i}`}>
                  <button
                    type="button"
                    onClick={() => onSelect({ label: r.label, lat: r.lat, lng: r.lng, inIndia: r.inIndia })}
                    className="block w-full px-3 py-2 text-left hover:bg-panel"
                  >
                    <span className="block">{r.label}</span>
                    <span className="block text-xs text-muted">
                      {formatCoords(r.lat, r.lng)}
                      {r.inIndia ? "" : " · outside India"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
