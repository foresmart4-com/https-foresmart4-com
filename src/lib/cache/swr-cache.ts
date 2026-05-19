// Lightweight stale-while-revalidate cache with retry queue and offline fallback.
// Client-only. Used for non-critical API fetches to lower latency and survive flaky networks.

interface Entry<T> { value: T; ts: number; }
const MEM = new Map<string, Entry<unknown>>();
const INFLIGHT = new Map<string, Promise<unknown>>();

export interface SwrOptions {
  ttlMs?: number;           // freshness window
  staleMs?: number;         // serve-stale window
  retries?: number;
  backoffMs?: number;
}

const DEFAULTS: Required<SwrOptions> = { ttlMs: 30_000, staleMs: 5 * 60_000, retries: 2, backoffMs: 600 };

async function withRetry<T>(fn: () => Promise<T>, retries: number, backoff: number): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; if (i < retries) await new Promise((r) => setTimeout(r, backoff * (i + 1))); }
  }
  throw lastErr;
}

export async function swr<T>(key: string, fetcher: () => Promise<T>, opts: SwrOptions = {}): Promise<T> {
  const o = { ...DEFAULTS, ...opts };
  const now = Date.now();
  const cached = MEM.get(key) as Entry<T> | undefined;
  const age = cached ? now - cached.ts : Infinity;

  if (cached && age < o.ttlMs) return cached.value;

  const run = () => withRetry(fetcher, o.retries, o.backoffMs)
    .then((v) => { MEM.set(key, { value: v, ts: Date.now() }); INFLIGHT.delete(key); return v; })
    .catch((e) => { INFLIGHT.delete(key); throw e; });

  if (cached && age < o.staleMs) {
    if (!INFLIGHT.has(key)) INFLIGHT.set(key, run().catch(() => cached.value));
    return cached.value;
  }

  if (INFLIGHT.has(key)) return INFLIGHT.get(key) as Promise<T>;
  const p = run();
  INFLIGHT.set(key, p);
  try { return await p; }
  catch (e) { if (cached) return cached.value; throw e; }
}

export function invalidate(prefix?: string) {
  if (!prefix) { MEM.clear(); return; }
  for (const k of MEM.keys()) if (k.startsWith(prefix)) MEM.delete(k);
}

export function cacheStats() {
  return { entries: MEM.size, inflight: INFLIGHT.size, keys: [...MEM.keys()] };
}
