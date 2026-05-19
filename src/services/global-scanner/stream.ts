// Lightweight realtime streaming layer: subscribers receive scanner snapshots
// on every tick. Cached for SNAPSHOT_TTL to throttle cost.
import { ingestAllFeeds } from "./feeds";
import { buildOpportunities, summarize } from "./opportunities";
import type { ScannerSnapshot } from "./types";

const TICK_MS = 20_000;
const SNAPSHOT_TTL = 15_000;
let _lastSnap: ScannerSnapshot | null = null;
let _lastAt = 0;
let _interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(s: ScannerSnapshot) => void>();

export async function getSnapshot(force = false): Promise<ScannerSnapshot> {
  const now = Date.now();
  if (!force && _lastSnap && now - _lastAt < SNAPSHOT_TTL) return _lastSnap;
  const { feeds, sources } = await ingestAllFeeds(now);
  const { opportunities, alerts } = buildOpportunities(feeds);
  const metrics = summarize(feeds, opportunities);
  const snap: ScannerSnapshot = {
    generatedAt: now,
    opportunities,
    alerts,
    feedsSummary: metrics.sources,
    metrics: {
      feedCount: metrics.feedCount,
      highUrgency: metrics.highUrgency,
      riskAdjustedAvg: metrics.riskAdjustedAvg,
      bullish: metrics.bullish,
      bearish: metrics.bearish,
      neutral: metrics.neutral,
    },
  };
  // Suppress unused var lint
  void sources;
  _lastSnap = snap; _lastAt = now;
  for (const fn of listeners) { try { fn(snap); } catch { /* swallow */ } }
  return snap;
}

export function subscribeScanner(fn: (s: ScannerSnapshot) => void): () => void {
  listeners.add(fn);
  if (!_interval) {
    _interval = setInterval(() => { void getSnapshot(true); }, TICK_MS);
  }
  // Push current snapshot immediately if available
  if (_lastSnap) fn(_lastSnap);
  else void getSnapshot();
  return () => {
    listeners.delete(fn);
    if (!listeners.size && _interval) { clearInterval(_interval); _interval = null; }
  };
}
