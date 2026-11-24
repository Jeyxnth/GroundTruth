import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EeError, evaluate } from "@/lib/ee/client";

type Cb = (v: number, err?: string) => void;
const fake = (script: Array<{ value?: number; err?: string }>) => {
  let i = 0;
  const calls = { n: 0 };
  return {
    calls,
    obj: {
      evaluate(cb: Cb) {
        calls.n++;
        const step = script[Math.min(i++, script.length - 1)]!;
        queueMicrotask(() => (step.err ? cb(undefined as never, step.err) : cb(step.value as number)));
      },
    },
  };
};

describe("evaluate retries", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries a transient capacity error and then succeeds", async () => {
    const f = fake([{ err: "Earth Engine memory capacity exceeded." }, { value: 7 }]);
    const p = evaluate<number>(f.obj);
    await vi.advanceTimersByTimeAsync(2_100);
    await expect(p).resolves.toBe(7);
    expect(f.calls.n).toBe(2);
  });

  it("gives up after the backoff schedule and reports a retryable quota error", async () => {
    const f = fake([{ err: "Too many concurrent aggregations." }]);
    const p = evaluate<number>(f.obj);
    const assertion = expect(p).rejects.toMatchObject({ kind: "quota" });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(f.calls.n).toBe(3); // first try plus two retries
  });

  it("does not retry a real computation error", async () => {
    const f = fake([{ err: "Image.normalizedDifference: No band named 'swir1'." }]);
    await expect(evaluate<number>(f.obj)).rejects.toMatchObject({ kind: "compute" });
    expect(f.calls.n).toBe(1);
    expect(EeError).toBeDefined();
  });
});
