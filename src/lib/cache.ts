import { unstable_cache } from "next/cache";

interface Entry {
  expires: number;
  value: unknown;
}
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;

/**
 * Two-layer cache for expensive EE results:
 *  1. in-process Map (instant, de-duplicates concurrent identical requests),
 *  2. Next.js data cache via unstable_cache (persists across instances and deployments).
 * Errors are never cached. Set GT_DISABLE_NEXT_CACHE=1 (tests) to skip layer 2.
 */
export async function cached<T>(
  name: string,
  keyParts: ReadonlyArray<string | number>,
  revalidateSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const key = [name, ...keyParts].join("|");
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const run =
    process.env.GT_DISABLE_NEXT_CACHE === "1"
      ? compute
      : unstable_cache(compute, [name, ...keyParts.map(String)], { revalidate: revalidateSeconds });

  const p = run()
    .then((value) => {
      if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value as string);
      memory.set(key, { value, expires: Date.now() + Math.min(revalidateSeconds, 3600) * 1000 });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const SECONDS = { hour: 3600, day: 86400, week: 604800, month: 2_592_000 } as const;
