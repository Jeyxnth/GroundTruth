import { describe, expect, it } from "vitest";
import { circlePolygon, distanceM, formatCoords, zoneUrl } from "@/lib/geometry";
import { parseZoneParams } from "@/lib/zone-params";

describe("circlePolygon", () => {
  it("is a closed ring whose points are all radiusM from the centre", () => {
    const f = circlePolygon(12.9413, 80.2179, 150);
    const ring = f.geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lng, lat] of ring) {
      expect(distanceM({ lat: 12.9413, lng: 80.2179 }, { lat, lng })).toBeGreaterThan(149.5);
      expect(distanceM({ lat: 12.9413, lng: 80.2179 }, { lat, lng })).toBeLessThan(150.5);
    }
  });
  it("works near the antimeridian without leaving [-180, 180]", () => {
    const ring = circlePolygon(0, 179.9999, 500).geometry.coordinates[0]!;
    expect(ring.every(([lng]) => lng >= -180 && lng <= 180)).toBe(true);
  });
});

describe("distanceM", () => {
  it("matches a known distance (1 degree of latitude is about 111.2 km)", () => {
    expect(distanceM({ lat: 10, lng: 77 }, { lat: 11, lng: 77 })).toBeGreaterThan(111_000);
    expect(distanceM({ lat: 10, lng: 77 }, { lat: 11, lng: 77 })).toBeLessThan(111_400);
    expect(distanceM({ lat: 10, lng: 77 }, { lat: 10, lng: 77 })).toBe(0);
  });
});

describe("zoneUrl / parseZoneParams (stable report URLs)", () => {
  it("encodes lat/lng and round-trips through the page parser", () => {
    const url = zoneUrl("/report", { lat: 12.941337, lng: 80.217912, label: "Perungudi, Chennai" });
    expect(url).toBe("/report?lat=12.9413&lng=80.2179&q=Perungudi%2C+Chennai");
    const sp = Object.fromEntries(new URL(url, "http://x").searchParams.entries());
    const r = parseZoneParams(sp);
    expect(r).toEqual({ ok: true, zone: { lat: 12.9413, lng: 80.2179, radiusM: 150, label: "Perungudi, Chennai" } });
  });
  it("only adds radius when it is not the default", () => {
    expect(zoneUrl("/analyze", { lat: 1, lng: 2, radiusM: 150 })).not.toMatch(/radius/);
    expect(zoneUrl("/analyze", { lat: 1, lng: 2, radiusM: 300 })).toMatch(/radius=300/);
  });
  it("rejects invalid or missing coordinates with a message", () => {
    expect(parseZoneParams({ lat: "999", lng: "10" }).ok).toBe(false);
    expect(parseZoneParams({}).ok).toBe(false);
    expect(parseZoneParams({ lat: "10", lng: "10", radius: "9" }).ok).toBe(false);
  });
  it("takes the first value when a param is repeated", () => {
    const r = parseZoneParams({ lat: ["10", "20"], lng: "30" });
    expect(r.ok && r.zone.lat).toBe(10);
  });
  it("formats coordinates", () => {
    expect(formatCoords(12.94131, 80.2)).toBe("12.9413, 80.2000");
  });
});
