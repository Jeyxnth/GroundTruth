import type { ApiErrorBody, ApiOkBody, ErrorCode } from "@/lib/api";

/** What a section shows when its request fails. `retryable` decides whether a Retry button is offered. */
export class SectionError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode | "network" | "timeout" | "bad_response",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SectionError";
  }
}

export interface Loaded<T> {
  data: T;
  notes: string[];
}

const DEFAULT_TIMEOUT_MS = 170_000; // a little above the longest route (imagery, 120 s server limit)

/** Fetch an API route and unwrap the typed envelope. Never throws anything but SectionError (or AbortError on cancel). */
export async function getJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Loaded<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: combined });
  } catch (e) {
    if (signal?.aborted) throw e; // caller cancelled: let it through silently
    if (timeout.aborted) throw new SectionError("This is taking longer than expected.", "timeout", true);
    throw new SectionError("Could not reach the server. Check your connection and retry.", "network", true);
  }

  let body: ApiOkBody<T> | ApiErrorBody;
  try {
    body = (await res.json()) as ApiOkBody<T> | ApiErrorBody;
  } catch {
    // e.g. a platform timeout page instead of our JSON
    throw new SectionError(
      res.status === 504 ? "The analysis timed out. Please retry." : "The server sent an unexpected response. Please retry.",
      "bad_response",
      true,
    );
  }
  if (!body.ok) throw new SectionError(body.error.message, body.error.code, body.error.retryable);
  return { data: body.data, notes: body.meta.notes ?? [] };
}
