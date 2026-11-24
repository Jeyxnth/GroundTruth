import ee from "@google/earthengine";
import { decodeServiceAccountKey, getEnv, missingEeEnv } from "@/lib/env";

/** Thrown when EE cannot be used; `kind` lets routes map to typed HTTP errors. */
export class EeError extends Error {
  constructor(
    message: string,
    public readonly kind: "not_configured" | "auth" | "init" | "timeout" | "quota" | "compute",
  ) {
    super(message);
    this.name = "EeError";
  }
}

let ready: Promise<typeof ee> | undefined;

/** Authenticate + initialize Earth Engine once per warm instance and reuse it. */
export function getEe(): Promise<typeof ee> {
  ready ??= initialise().catch((err) => {
    ready = undefined; // allow retry on the next request
    throw err;
  });
  return ready;
}

async function initialise(): Promise<typeof ee> {
  const env = getEnv();
  const missing = missingEeEnv(env);
  if (missing.length > 0) {
    throw new EeError(`Missing environment variable(s): ${missing.join(", ")}`, "not_configured");
  }
  const key = decodeServiceAccountKey(env.GEE_SERVICE_ACCOUNT_KEY_B64!);

  await new Promise<void>((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(key, resolve, (m) =>
      reject(new EeError(`Earth Engine authentication failed: ${m}`, "auth")),
    );
  });
  await new Promise<void>((resolve, reject) => {
    ee.initialize(
      null,
      null,
      resolve,
      (e) => reject(new EeError(`Earth Engine initialization failed: ${String(e)}`, "init")),
      null,
      env.GEE_PROJECT_ID,
    );
  });
  return ee;
}

/** Evaluate an EE object server-side, as a promise with a timeout. */
export function evaluate<T>(obj: { evaluate: (cb: (v: T, err?: string) => void) => void }, timeoutMs = 45_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new EeError(`Earth Engine computation timed out after ${timeoutMs} ms`, "timeout")),
      timeoutMs,
    );
    obj.evaluate((value, err) => {
      clearTimeout(timer);
      if (err) {
        const kind = /quota|too many|rate|429/i.test(err) ? "quota" : "compute";
        reject(new EeError(err, kind));
      } else resolve(value);
    });
  });
}
