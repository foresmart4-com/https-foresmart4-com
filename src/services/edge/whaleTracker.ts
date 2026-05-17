// Whale activity tracker — flags abnormal moves and imbalance from price/volatility behavior.
// Pure heuristic on existing quotes; no on-chain calls.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export type AlertSeverity = "info" | "warning" | "critical";

export interface WhaleSignal {
  asset: AssetKey;
  assetName: string;
  activityScore: number;     // 0-100
  manipulationRisk: number;  // 0-100
  directionalBias: "long" | "short" | "neutral";
  severity: AlertSeverity;
  spikeStrength: number;     // 0-100 unusual volume/volatility spike
  imbalance: number;         // -100..100
  note: string;
}

export interface WhaleReport {
  signals: WhaleSignal[];
  topAsset: WhaleSignal | null;
  marketImbalance: number; // -100..100 aggregate
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function analyzeOne(q: MarketQuote): WhaleSignal {
  const h = q.history;
  const sFull = stdev(h) || 1e-9;
  const recent = h.slice(-Math.max(3, Math.floor(h.length / 5)));
  const sRecent = stdev(recent);
  const spikeStrength = Math.max(0, Math.min(100, Math.round((sRecent / sFull - 1) * 120 + Math.abs(q.changePct) * 8)));

  // Imbalance: sign + magnitude of recent move vs baseline
  const last = h[h.length - 1];
  const mid = h[Math.floor(h.length / 2)] || last;
  const imbalance = Math.max(-100, Math.min(100, Math.round(((last - mid) / (mid || 1)) * 600)));

  const activityScore = Math.max(0, Math.min(100, Math.round(spikeStrength * 0.6 + Math.abs(imbalance) * 0.35 + q.volatility * 0.15)));
  const manipulationRisk = Math.max(0, Math.min(100, Math.round(
    spikeStrength * 0.5 + (q.volatility > 60 ? 25 : 0) + (Math.abs(imbalance) > 60 ? 20 : 0),
  )));

  const directionalBias: WhaleSignal["directionalBias"] =
    imbalance > 25 ? "long" : imbalance < -25 ? "short" : "neutral";

  const severity: AlertSeverity =
    activityScore >= 75 ? "critical" : activityScore >= 50 ? "warning" : "info";

  const note = severity === "critical"
    ? `Abnormal ${directionalBias} activity on ${q.name}; manipulation risk elevated.`
    : severity === "warning"
      ? `Unusual ${directionalBias === "neutral" ? "two-way" : directionalBias} flow on ${q.name}.`
      : `Activity within normal range.`;

  return {
    asset: q.key, assetName: q.name,
    activityScore, manipulationRisk, directionalBias, severity,
    spikeStrength, imbalance, note,
  };
}

export function trackWhaleActivity(quotes: MarketQuote[]): WhaleReport {
  const signals = quotes.map(analyzeOne).sort((a, b) => b.activityScore - a.activityScore);
  const topAsset = signals[0] ?? null;
  const marketImbalance = signals.length
    ? Math.round(signals.reduce((s, x) => s + x.imbalance, 0) / signals.length)
    : 0;
  return { signals, topAsset, marketImbalance };
}
