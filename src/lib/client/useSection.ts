"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, SectionError } from "@/lib/client/fetch";

export type SectionState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T; notes: string[] }
  | { status: "error"; error: SectionError };

export type Section<T> = SectionState<T> & { retry: () => void };

/**
 * Loads one API section. State is derived from "which request produced the stored result", so there is no
 * synchronous setState in the effect and a stale response can never overwrite a newer one.
 */
export function useSection<T>(url: string | null, init?: RequestInit): Section<T> {
  const [attempt, setAttempt] = useState(0);
  const key = url ? `${url}#${attempt}` : null;
  const [result, setResult] = useState<{ key: string; state: SectionState<T> } | null>(null);
  const method = init?.method;
  const body = typeof init?.body === "string" ? init.body : undefined;

  useEffect(() => {
    if (!key || !url) return;
    const ac = new AbortController();
    getJson<T>(url, { signal: ac.signal, method, body, headers: body ? { "Content-Type": "application/json" } : undefined })
      .then((r) => setResult({ key, state: { status: "ok", data: r.data, notes: r.notes } }))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        const error = e instanceof SectionError ? e : new SectionError("Something went wrong.", "bad_response", true);
        setResult({ key, state: { status: "error", error } });
      });
    return () => ac.abort();
  }, [key, url, method, body]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const state: SectionState<T> = result && result.key === key ? result.state : { status: "loading" };
  return { ...state, retry };
}
