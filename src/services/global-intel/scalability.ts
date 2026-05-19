// Client-side scaffolding for queue / cache / event-bus / batching.
// Designed to be swapped at the boundary for Redis / NATS / Kafka in production —
// the API surface stays the same.

type Listener<T> = (msg: T) => void;

export class EventBus<T = unknown> {
  private subs = new Map<string, Set<Listener<T>>>();
  on(topic: string, fn: Listener<T>) {
    if (!this.subs.has(topic)) this.subs.set(topic, new Set());
    this.subs.get(topic)!.add(fn);
    return () => this.subs.get(topic)?.delete(fn);
  }
  emit(topic: string, msg: T) {
    this.subs.get(topic)?.forEach((fn) => { try { fn(msg); } catch { /* swallow */ } });
  }
}

export class Queue<T> {
  private buf: T[] = [];
  private working = false;
  constructor(private worker: (item: T) => Promise<void>, private concurrency = 4) {}
  enqueue(item: T) { this.buf.push(item); void this.drain(); }
  size() { return this.buf.length; }
  private async drain() {
    if (this.working) return;
    this.working = true;
    while (this.buf.length) {
      const batch = this.buf.splice(0, this.concurrency);
      await Promise.allSettled(batch.map((b) => this.worker(b)));
    }
    this.working = false;
  }
}

export class DistributedCache<V> {
  // In-memory L1 + localStorage L2 fallback to survive reloads.
  private mem = new Map<string, { v: V; exp: number }>();
  constructor(private prefix = "gi_cache:", private ttlMs = 60_000) {}
  get(key: string): V | null {
    const m = this.mem.get(key);
    if (m && m.exp > Date.now()) return m.v;
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p.exp > Date.now()) { this.mem.set(key, p); return p.v as V; }
    } catch { /* ignore */ }
    return null;
  }
  set(key: string, v: V, ttl = this.ttlMs) {
    const exp = Date.now() + ttl;
    this.mem.set(key, { v, exp });
    try { localStorage.setItem(this.prefix + key, JSON.stringify({ v, exp })); } catch { /* quota */ }
  }
  invalidate(key: string) {
    this.mem.delete(key);
    try { localStorage.removeItem(this.prefix + key); } catch { /* ignore */ }
  }
}

export const globalBus = new EventBus();
export const globalCache = new DistributedCache<unknown>();
