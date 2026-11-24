"use client";

import { useId, useRef, useState } from "react";
import { SEARCH_ERRORS } from "@/lib/copy";
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

function searchError(e: SectionError): string {
  if (e.code === "not_found") return SEARCH_ERRORS.notFound;
  if (e.code === "rate_limited") return SEARCH_ERRORS.busy;
  if (e.code === "network" || e.code === "timeout") return SEARCH_ERRORS.network;
  return e.message;
}

/** Address search (Nominatim via /api/geocode). Also accepts "lat, lng". One match opens straight away; several are listed. */
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
      setState({ status: "error", message: SEARCH_ERRORS.short, retryable: false });
      return;
    }
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setState({ status: "searching" });
    try {
      const { data } = await getJson<GeocodeData>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ac.signal, timeoutMs: 20_000 });
      const only = data.results.length === 1 ? data.results[0] : undefined;
      if (only) {
        onSelect({ label: only.label, lat: only.lat, lng: only.lng, inIndia: only.inIndia });
        setState({ status: "idle" });
      } else setState({ status: "results", results: data.results });
    } catch (err) {
      if (ac.signal.aborted) return;
      const e2 = err instanceof SectionError ? err : new SectionError("Search failed.", "bad_response", true);
      setState({ status: "error", message: searchError(e2), retryable: e2.retryable });
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={search} role="search" className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className={compact ? "sr-only" : "mb-1.5 block font-medium"}>
            Address, locality or coordinates
          </label>
          <input
            id={inputId}
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            name="q"
            placeholder="Perungudi, Chennai or 12.9413, 80.2179…"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-lg border border-line bg-surface px-3.5 text-base"
            aria-describedby={`${listId}-status`}
          />
        </div>
        <button type="submit" className={`btn btn-primary h-12 self-end px-5`} disabled={state.status === "searching"}>
          {state.status === "searching" ? "Searching…" : "Search"}
        </button>
      </form>

      <div id={`${listId}-status`} aria-live="polite" className="mt-2 text-base">
        {state.status === "searching" && <p className="text-muted">Looking up the place…</p>}
        {state.status === "error" && (
          <p role="alert" className="text-[var(--band-high)]">
            {state.message}{" "}
            {state.retryable && (
              <button type="button" onClick={() => search()} className="tap underline">
                Try again
              </button>
            )}
          </p>
        )}
        {state.status === "results" && (
          <>
            <p className="text-muted">Choose the right place:</p>
            <ul id={listId} className="mt-1 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {state.results.map((r, i) => (
                <li key={`${r.lat},${r.lng},${i}`}>
                  <button
                    type="button"
                    onClick={() => onSelect({ label: r.label, lat: r.lat, lng: r.lng, inIndia: r.inIndia })}
                    className="block min-h-[44px] w-full px-3.5 py-2.5 text-left hover:bg-panel"
                  >
                    <span className="block">{r.label}</span>
                    <span className="block font-mono text-sm text-muted">
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
