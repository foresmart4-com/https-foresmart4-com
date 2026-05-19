// Health monitoring + provider failover decisions.
import { PROVIDERS, providersFor, type ProviderSpec } from "./providers";
import type { AssetClass, ProviderHealth } from "./types";
import { fusionBus } from "./eventBus";

interface MutableHealth {
  provider: string;
  latencies: number[];        // ring buffer
  errors: number;
  ticks: number;
  lastTickAt: number;
  up: boolean;
}

const STATE = new Map<string, MutableHealth>();

function ensure(id: string): MutableHealth {
  let s = STATE.get(id);
  if (!s) {
    s = { provider: id, latencies: [], errors: 0, ticks: 0, lastTickAt: 0, up: true };
    STATE.set(id, s);
  }
  return s;
}

export function recordTick(provider: string, latencyMs: number, atMs = Date.now()): void {
  const s = ensure(provider);
  s.latencies.push(latencyMs);
  if (s.latencies.length > 50) s.latencies.shift();
  s.ticks++;
  s.lastTickAt = atMs;
  s.up = true;
}

export function recordError(provider: string): void {
  const s = ensure(provider);
  s.errors++;
  if (s.errors > 5 && s.errors / Math.max(1, s.ticks) > 0.5) s.up = false;
}

export function markDown(provider: string): void {
  const s = ensure(provider);
  s.up = false;
}

export function snapshotHealth(provider: string, now = Date.now()): ProviderHealth {
  const spec = PROVIDERS.find((p) => p.id === provider);
  const s = ensure(provider);
  const avgLatency = s.latencies.length
    ? s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length
    : spec?.baseLatencyMs ?? 200;
  const lastTickAgoMs = s.lastTickAt ? now - s.lastTickAt : Number.POSITIVE_INFINITY;
  const errorRate = s.ticks ? s.errors / s.ticks : 0;
  const stale = lastTickAgoMs > (spec?.staleAfterMs ?? 10_000);
  const reliability = spec?.reliability ?? 0.9;
  const latencyScore = Math.max(0, 1 - avgLatency / 600);
  const freshnessScore = stale ? 0 : Math.max(0, 1 - lastTickAgoMs / ((spec?.staleAfterMs ?? 10_000) * 1.5));
  const confidence = Math.max(0, Math.min(1,
    0.5 * reliability + 0.25 * latencyScore + 0.25 * freshnessScore - errorRate * 0.4,
  ));
  const health: ProviderHealth = {
    provider,
    up: s.up && !stale,
    latencyMs: Math.round(avgLatency),
    lastTickAgoMs: Math.round(lastTickAgoMs),
    errorRate: Math.round(errorRate * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,
    stale,
  };
  return health;
}

export function allHealth(now = Date.now()): ProviderHealth[] {
  return PROVIDERS.map((p) => snapshotHealth(p.id, now));
}

/** Failover: pick best healthy provider for an asset class. */
export function selectProvider(assetClass: AssetClass, exclude: string[] = []): ProviderSpec | null {
  const candidates = providersFor(assetClass).filter((p) => !exclude.includes(p.id));
  let best: { spec: ProviderSpec; score: number } | null = null;
  for (const spec of candidates) {
    const h = snapshotHealth(spec.id);
    if (!h.up) continue;
    const score = h.confidence * 100 + spec.priority * 0.1;
    if (!best || score > best.score) best = { spec, score };
  }
  return best?.spec ?? null;
}

export function failover(
  symbol: string,
  assetClass: AssetClass,
  failedProvider: string,
): ProviderSpec | null {
  markDown(failedProvider);
  const next = selectProvider(assetClass, [failedProvider]);
  if (next) {
    fusionBus.emit({ type: "provider:failover", from: failedProvider, to: next.id, symbol });
  }
  return next;
}

/** Periodic stale-feed detection — call from orchestrator. */
export function scanStaleFeeds(symbols: { symbol: string; assetClass: AssetClass; provider: string }[]) {
  const now = Date.now();
  for (const entry of symbols) {
    const h = snapshotHealth(entry.provider, now);
    if (h.stale) {
      fusionBus.emit({ type: "stale", provider: entry.provider, symbol: entry.symbol });
    }
  }
}
