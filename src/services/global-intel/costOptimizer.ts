// Cost optimization layer: smart caching, batching, selective inference, hybrid routing.
import { DistributedCache } from "./scalability";

const aiCache = new DistributedCache<string>("gi_ai:", 5 * 60_000);

export type Tier = "local" | "fast" | "premium";

export function chooseTier(input: { confidence: number; criticality: number; tokens: number }): Tier {
  if (input.tokens < 200 && input.criticality < 0.4) return "local";
  if (input.confidence > 0.75 && input.criticality < 0.7) return "fast";
  return "premium";
}

export const MODEL_FOR_TIER: Record<Tier, string> = {
  local: "google/gemini-2.5-flash-lite",
  fast: "google/gemini-2.5-flash",
  premium: "google/gemini-2.5-pro",
};

export function cacheKey(parts: Array<string | number>): string {
  return parts.join("|");
}
export function getCachedAI(key: string): string | null {
  return aiCache.get(key);
}
export function setCachedAI(key: string, value: string) {
  aiCache.set(key, value);
}

// Batches inputs with a microtask debounce.
export class Batcher<I, O> {
  private buf: Array<{ input: I; resolve: (o: O) => void; reject: (e: unknown) => void }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private flush: (items: I[]) => Promise<O[]>, private windowMs = 25, private maxBatch = 16) {}
  add(input: I): Promise<O> {
    return new Promise((resolve, reject) => {
      this.buf.push({ input, resolve, reject });
      if (this.buf.length >= this.maxBatch) this.go();
      else if (!this.timer) this.timer = setTimeout(() => this.go(), this.windowMs);
    });
  }
  private async go() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const items = this.buf.splice(0);
    if (!items.length) return;
    try {
      const out = await this.flush(items.map((i) => i.input));
      items.forEach((it, idx) => it.resolve(out[idx]));
    } catch (e) {
      items.forEach((it) => it.reject(e));
    }
  }
}
