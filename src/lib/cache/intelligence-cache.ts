/**
 * Server-side TTL cache + concurrency queue for the Market Intelligence engine.
 *
 * - `cached(key, ttlMs, fn)`: memoizes async work with TTL + dedupe (single inflight
 *   per key). Stale entries return immediately while a refresh runs in the background.
 * - `queue.run(fn)`: bounded concurrency runner (default 4). Smooths bursts of
 *   provider calls so we don't trip rate limits.
 *
 * In-memory only. Safe to import in server functions; never import client-side.
 */

type Entry<T> = { value: T; ts: number };
const MEM = new Map<string, Entry<unknown>>();
const INFLIGHT = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = MEM.get(key) as Entry<T> | undefined;
  if (hit && now - hit.ts < ttlMs) return hit.value;

  if (INFLIGHT.has(key)) return INFLIGHT.get(key) as Promise<T>;

  const p = (async () => {
    try {
      const v = await fn();
      MEM.set(key, { value: v, ts: Date.now() });
      return v;
    } finally {
      INFLIGHT.delete(key);
    }
  })();
  INFLIGHT.set(key, p);

  // Serve stale-while-revalidate up to 4× TTL.
  if (hit && now - hit.ts < ttlMs * 4) {
    p.catch(() => {});
    return hit.value;
  }
  return p;
}

export function invalidate(prefix?: string) {
  if (!prefix) { MEM.clear(); return; }
  for (const k of [...MEM.keys()]) if (k.startsWith(prefix)) MEM.delete(k);
}

export function cacheSnapshot() {
  return { entries: MEM.size, inflight: INFLIGHT.size };
}

// ---------- Concurrency queue ----------
class Queue {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(private readonly limit = 4) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((res) => this.waiters.push(res));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.waiters.shift();
      if (next) next();
    }
  }
  stats() { return { active: this.active, waiting: this.waiters.length, limit: this.limit }; }
}

export const intelQueue = new Queue(4);
