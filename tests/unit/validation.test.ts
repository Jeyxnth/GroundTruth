import { describe, expect, it } from "vitest";
import { ApiError, toApiError } from "@/lib/api";
import { EeError } from "@/lib/ee/client";
import { parseCoordinates } from "@/lib/geocode";
import { isWithinIndiaBounds, zoneNotes } from "@/lib/geo";
import { factsSchema, geocodeQuerySchema, zoneQuerySchema } from "@/lib/validation";

describe("zoneQuerySchema", () => {
  it("accepts valid input, rounds to 4 decimals and defaults the radius", () => {
    const r = zoneQuerySchema.parse({ lat: "12.941337", lng: "80.217912" });
    expect(r).toEqual({ lat: 12.9413, lng: 80.2179, radiusM: 150 });
  });

  it("accepts an explicit radius within bounds", () => {
    expect(zoneQuerySchema.parse({ lat: "10", lng: "10", radius: "300" }).radiusM).toBe(300);
    expect(zoneQuerySchema.safeParse({ lat: "10", lng: "10", radius: "50" }).success).toBe(true);
    expect(zoneQuerySchema.safeParse({ lat: "10", lng: "10", radius: "500" }).success).toBe(true);
  });

  it.each([
    [{ lat: "91", lng: "10" }, /lat/],
    [{ lat: "-91", lng: "10" }, /lat/],
    [{ lat: "10", lng: "181" }, /lng/],
    [{ lat: "10", lng: "-181" }, /lng/],
    [{ lat: "abc", lng: "10" }, /lat/],
    [{ lat: "", lng: "10" }, /lat/],
    [{ lat: "10" }, /lng/],
    [{ lat: "NaN", lng: "10" }, /lat/],
    [{ lat: "Infinity", lng: "10" }, /lat/],
    [{ lat: "10", lng: "10", radius: "49" }, /radius/],
    [{ lat: "10", lng: "10", radius: "501" }, /radius/],
    [{ lat: "10", lng: "10", radius: "-5" }, /radius/],
  ])("rejects %j", (input, message) => {
    const r = zoneQuerySchema.safeParse(input);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join()).toMatch(message);
  });

  it("does not turn an empty string into 0", () => {
    expect(zoneQuerySchema.safeParse({ lat: "", lng: "" }).success).toBe(false);
  });
});

describe("geocodeQuerySchema", () => {
  it("trims, defaults country to India and enforces length", () => {
    expect(geocodeQuerySchema.parse({ q: "  Velachery Chennai " })).toEqual({ q: "Velachery Chennai", country: "in" });
    expect(geocodeQuerySchema.safeParse({ q: "ab" }).success).toBe(false);
    expect(geocodeQuerySchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
    expect(geocodeQuerySchema.safeParse({ q: "Paris", country: "fr" }).success).toBe(false);
    expect(geocodeQuerySchema.parse({ q: "Dubai", country: "all" }).country).toBe("all");
  });
});

describe("factsSchema", () => {
  it("rejects unknown enum values and wrong types", () => {
    expect(factsSchema.safeParse({}).success).toBe(false);
    expect(factsSchema.safeParse(null).success).toBe(false);
  });
});

describe("parseCoordinates", () => {
  it("parses lat,lng pairs", () => {
    expect(parseCoordinates("12.9716, 77.5946")).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(parseCoordinates("12.9716 77.5946")).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(parseCoordinates("-33.8, 151.2")).toEqual({ lat: -33.8, lng: 151.2 });
  });
  it("returns null for addresses and out-of-range values", () => {
    expect(parseCoordinates("Velachery, Chennai")).toBeNull();
    expect(parseCoordinates("95, 10")).toBeNull();
    expect(parseCoordinates("10, 200")).toBeNull();
  });
});

describe("India bounds note", () => {
  it("flags points outside India but not inside", () => {
    expect(isWithinIndiaBounds(12.97, 77.59)).toBe(true);
    expect(isWithinIndiaBounds(51.5, -0.12)).toBe(false);
    expect(zoneNotes(12.97, 77.59)).toEqual([]);
    expect(zoneNotes(51.5, -0.12)[0]).toMatch(/outside India/);
  });
});

describe("toApiError", () => {
  it("maps Zod errors to a 400 invalid_input", () => {
    const r = zoneQuerySchema.safeParse({ lat: "x", lng: "1" });
    if (r.success) throw new Error("expected failure");
    const e = toApiError(r.error);
    expect(e.status).toBe(400);
    expect(e.code).toBe("invalid_input");
    expect(e.retryable).toBe(false);
  });

  it.each([
    ["not_configured", 503, "ee_not_configured", false],
    ["auth", 503, "ee_unavailable", true],
    ["init", 503, "ee_unavailable", true],
    ["timeout", 504, "ee_timeout", true],
    ["quota", 429, "ee_quota", true],
    ["compute", 502, "ee_compute_failed", true],
  ] as const)("maps EeError %s", (kind, status, code, retryable) => {
    const e = toApiError(new EeError("secret internal detail", kind));
    expect([e.status, e.code, e.retryable]).toEqual([status, code, retryable]);
    expect(e.message).not.toMatch(/secret internal detail/);
  });

  it("hides unexpected errors behind a generic 500", () => {
    const e = toApiError(new Error("db password is hunter2"));
    expect(e.status).toBe(500);
    expect(e.message).not.toMatch(/hunter2/);
  });

  it("passes ApiError through", () => {
    const original = new ApiError("not_found", "nothing", 404);
    expect(toApiError(original)).toBe(original);
  });
});
