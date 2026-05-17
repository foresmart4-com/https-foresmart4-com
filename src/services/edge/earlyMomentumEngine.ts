// Early momentum detection — flags assets showing acceleration before a major
// expansion move. Pure calculations on existing quote history (no API calls).
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export interface EarlyMomentumReport {
  asset: AssetKey;
  assetName: string;
  score: number;            // 0-100  early momentum strength
  breakoutProbability: number; // 0-100
  confidence: number;       // 0-100
  acceleration: number;     // -100..100  momentum derivative
  compression: number;      // 0-100  volatility contraction
  trendAcceleration: number; // 0-100
  volumeShift: number;      // -100..100 (proxy from range expansion)
  sentimentAccel: number;   // -100..100
  warning: "none" | "watch" | "imminent";
  note: string;
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function pctRange(arr: number[]): number {
  if (!arr.length) return 0;
  const hi = Math.max(...arr);
  const lo = Math.min(...arr);
  return lo > 0 ? ((hi - lo) / lo) * 100 : 0;
}

export function analyzeEarlyMomentum(
  q: MarketQuote,
  sentiment?: MarketSentimentScore,
  prevSentimentScore?: number,
): EarlyMomentumReport {
  const h = q.history;
  const n = h.length;
  const half = Math.max(4, Math.floor(n / 2));
  const recent = h.slice(-half);
  const older = h.slice(0, half);

  // Acceleration: difference between recent slope and prior slope
  const recentSlope = recent.length > 1 ? (recent[recent.length - 1] - recent[0]) / recent[0] * 100 : 0;
  const olderSlope = older.length > 1 ? (older[older.length - 1] - older[0]) / older[0] * 100 : 0;
  const acceleration = +(recentSlope - olderSlope).toFixed(2);

  // Volatility compression: recent stdev vs prior stdev
  const sR = stdev(recent), sO = stdev(older) || 1e-9;
  const compressionRatio = sR / sO;
  const compression = Math.max(0, Math.min(100, Math.round((1 - compressionRatio) * 100)));

  // Trend acceleration normalized
  const trendAcceleration = Math.max(0, Math.min(100, Math.round(Math.abs(acceleration) * 18)));

  // Volume shift proxy: range expansion in last quarter vs first quarter
  const q1 = pctRange(h.slice(0, Math.max(3, Math.floor(n / 4))));
  const q4 = pctRange(h.slice(-Math.max(3, Math.floor(n / 4))));
  const volumeShift = Math.max(-100, Math.min(100, Math.round(((q4 - q1) / (q1 || 1)) * 50)));

  // Sentiment acceleration
  const sentScore = sentiment?.score ?? 50;
  const sentimentAccel = prevSentimentScore != null
    ? Math.max(-100, Math.min(100, Math.round((sentScore - prevSentimentScore) * 2)))
    : 0;

  // Composite early momentum score
  const score = Math.max(0, Math.min(100, Math.round(
    Math.abs(acceleration) * 12 + compression * 0.35 + Math.abs(volumeShift) * 0.2 + Math.abs(sentimentAccel) * 0.15,
  )));

  // Breakout probability — compression + acceleration + volume expansion
  const breakoutProbability = Math.max(0, Math.min(100, Math.round(
    compression * 0.45 + Math.abs(acceleration) * 9 + Math.max(0, volumeShift) * 0.3,
  )));

  const confidence = Math.max(30, Math.min(95, Math.round(
    score * 0.5 + breakoutProbability * 0.35 + (q.volatility < 60 ? 10 : 0),
  )));

  let warning: EarlyMomentumReport["warning"] = "none";
  if (breakoutProbability > 70 && compression > 55) warning = "imminent";
  else if (breakoutProbability > 50 || score > 55) warning = "watch";

  const dir = acceleration > 0 ? "upside" : "downside";
  const note = warning === "imminent"
    ? `Compression + ${dir} acceleration — breakout probability elevated.`
    : warning === "watch"
      ? `Early ${dir} build-up forming; monitor for confirmation.`
      : `No early-stage edge detected; momentum profile neutral.`;

  return {
    asset: q.key, assetName: q.name,
    score, breakoutProbability, confidence,
    acceleration, compression, trendAcceleration, volumeShift, sentimentAccel,
    warning, note,
  };
}

export function analyzeAllEarlyMomentum(
  quotes: MarketQuote[],
  sentiment?: MarketSentimentScore,
): EarlyMomentumReport[] {
  return quotes
    .map((q) => analyzeEarlyMomentum(q, sentiment))
    .sort((a, b) => b.score - a.score);
}
