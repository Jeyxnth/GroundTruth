import { describe, expect, it } from "vitest";
import { decodeServiceAccountKey, missingEeEnv, parseEnv } from "@/lib/env";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

describe("parseEnv", () => {
  it("applies defaults and treats empty strings as unset", () => {
    const env = parseEnv({ GEE_PROJECT_ID: "", ZONE_RADIUS_M: "" });
    expect(env.GEE_PROJECT_ID).toBeUndefined();
    expect(env.ZONE_RADIUS_M).toBe(150);
    expect(env.SEASON_START_MONTH).toBe(1);
    expect(env.SEASON_END_MONTH).toBe(3);
  });

  it("rejects out-of-range values", () => {
    expect(() => parseEnv({ SEASON_START_MONTH: "13" })).toThrow();
    expect(() => parseEnv({ ZONE_RADIUS_M: "5000" })).toThrow();
  });
});

describe("missingEeEnv", () => {
  it("lists missing variables by name", () => {
    expect(missingEeEnv(parseEnv({}))).toEqual(["GEE_SERVICE_ACCOUNT_KEY_B64", "GEE_PROJECT_ID"]);
    expect(missingEeEnv(parseEnv({ GEE_SERVICE_ACCOUNT_KEY_B64: "x", GEE_PROJECT_ID: "p" }))).toEqual([]);
  });
});

describe("decodeServiceAccountKey", () => {
  it("accepts a key with client_email and private_key", () => {
    const key = decodeServiceAccountKey(b64({ client_email: "a@b.iam", private_key: "k", extra: 1 }));
    expect(key.client_email).toBe("a@b.iam");
  });
  it("rejects non-base64 / non-JSON input", () => {
    expect(() => decodeServiceAccountKey("%%%not-json")).toThrow(/not valid base64/);
  });
  it("rejects JSON that is not a service account key", () => {
    expect(() => decodeServiceAccountKey(b64({ hello: "world" }))).toThrow(/client_email or private_key/);
  });
});
