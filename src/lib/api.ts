import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { EeError } from "@/lib/ee/client";

export type ErrorCode =
  | "invalid_input"
  | "not_found"
  | "ee_not_configured"
  | "ee_unavailable"
  | "ee_timeout"
  | "ee_quota"
  | "ee_compute_failed"
  | "rate_limited"
  | "upstream_error"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiErrorBody {
  ok: false;
  error: { code: ErrorCode; message: string; retryable: boolean; details?: unknown };
}
export interface ApiOkBody<T> {
  ok: true;
  data: T;
  meta: { lat?: number; lng?: number; radiusM?: number; notes: string[]; generatedAt: string };
}

function errorResponse(e: ApiError): NextResponse<ApiErrorBody> {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (e.code === "rate_limited") headers["Retry-After"] = "2";
  return NextResponse.json(
    { ok: false, error: { code: e.code, message: e.message, retryable: e.retryable, details: e.details } },
    { status: e.status, headers },
  );
}

/** Map any thrown value to a typed ApiError. Never exposes stack traces. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return new ApiError(
      "invalid_input",
      err.issues.map((i) => i.message).join("; "),
      400,
      false,
      err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  if (err instanceof EeError) {
    switch (err.kind) {
      case "not_configured":
        return new ApiError("ee_not_configured", "Earth Engine credentials are not configured on the server.", 503);
      case "auth":
      case "init":
        return new ApiError("ee_unavailable", "Could not connect to Earth Engine. Please try again shortly.", 503, true);
      case "timeout":
        return new ApiError("ee_timeout", "Earth Engine took too long to respond. Please retry.", 504, true);
      case "quota":
        return new ApiError("ee_quota", "Earth Engine is rate limited right now. Please retry in a moment.", 429, true);
      default:
        console.error("[api] EE compute error:", err.message);
        return new ApiError("ee_compute_failed", "Earth Engine could not compute this analysis.", 502, true);
    }
  }
  console.error("[api] unexpected error:", err);
  return new ApiError("internal_error", "Something went wrong on our side.", 500, true);
}

export function parseWith<T>(schema: ZodType<T, unknown>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw toApiError(r.error);
  return r.data;
}

export function parseQuery<T>(schema: ZodType<T, unknown>, req: NextRequest): T {
  return parseWith(schema, Object.fromEntries(req.nextUrl.searchParams.entries()));
}

/** Standard success/error wrapper for route handlers. */
export async function respond<T>(
  run: () => Promise<{ data: T; meta?: Partial<ApiOkBody<T>["meta"]> }>,
  opts: { cacheSeconds?: number } = {},
): Promise<NextResponse<ApiOkBody<T> | ApiErrorBody>> {
  try {
    const { data, meta } = await run();
    const cache = opts.cacheSeconds
      ? `public, s-maxage=${opts.cacheSeconds}, stale-while-revalidate=${opts.cacheSeconds * 7}`
      : "no-store";
    return NextResponse.json(
      { ok: true, data, meta: { notes: [], generatedAt: new Date().toISOString(), ...meta } },
      { headers: { "Cache-Control": cache } },
    );
  } catch (e) {
    return errorResponse(toApiError(e));
  }
}
