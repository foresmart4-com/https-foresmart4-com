// Market noise reduction — detects fake breakouts, vol spikes and chaos.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { BreakoutReport } from "@/services/edge/breakoutPrediction";
import type { LiquidityFlowReport } from "@/services/edge/liquidityFlow";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export interface NoiseReport {
  asset: AssetKey;
  assetName: string;
  noiseLevel: number;        // 0-100
  stabilityScore: number;    // 0-100
  cautionAdjustment: number; // 0-30 (subtract from confidence)
  fakeBreakoutRisk: number;  // 0-100
  flags: string[];
}

export interface NoiseSummary {
  marketNoise: number;       // 0-100
  marketStability: number;   // 0-100
  overreactionRisk: number;  // 0-100
  note: string;
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

export function detectNoise(
  q: MarketQuote,
  br: BreakoutReport | undefined,
  liquidity: LiquidityFlowReport,
  sentiment: MarketSentimentScore,
): NoiseReport {
  const h = q.history;
  const sRecent = stdev(h.slice(-6));
  const sPrior  = stdev(h.slice(0, Math.max(6, h.length - 6))) || 1e-9;
  const spike = Math.max(0, Math.min(100, Math.round((sRecent / sPrior - 1) * 90)));

  const flags: string[] = [];
  if (spike > 50) flags.push("Volatility spike");
  if (liquidity.concentration > 70) flags.push("Liquidity concentrated");
  if (Math.abs(sentiment.score - 50) > 38) flags.push("Sentiment overreaction");

  // Fake-breakout = price near range edge with low squeeze conviction
  const hi = Math.max(...h), lo = Math.min(...h), pos = (q.price - lo) / ((hi - lo) || 1);
  const nearEdge = Math.abs(pos - 0.5) > 0.4;
  const lowSqueeze = (br?.squeeze ?? 40) < 35;
  const fakeBreakoutRisk = Math.round(
    (nearEdge ? 45 : 10) + (lowSqueeze ? 25 : 0) + (q.volatility > 65 ? 20 : 0),
  );
  if (fakeBreakoutRisk > 60) flags.push("Fake-breakout risk");

  const noiseLevel = Math.max(0, Math.min(100, Math.round(
    spike * 0.4 + Math.max(0, q.volatility - 35) * 0.4
    + (liquidity.concentration > 60 ? 15 : 0) + (fakeBreakoutRisk > 55 ? 12 : 0),
  )));
  const stabilityScore = 100 - noiseLevel;
  const cautionAdjustment = Math.round(Math.min(30, noiseLevel * 0.3));

  return {
    asset: q.key, assetName: q.name,
    noiseLevel, stabilityScore, cautionAdjustment, fakeBreakoutRisk, flags,
  };
}

export function detectAllNoise(
  quotes: MarketQuote[],
  breakouts: BreakoutReport[],
  liquidity: LiquidityFlowReport,
  sentiment: MarketSentimentScore,
): { reports: NoiseReport[]; summary: NoiseSummary } {
  const brMap = new Map(breakouts.map((b) => [b.asset, b]));
  const reports = quotes.map((q) => detectNoise(q, brMap.get(q.key), liquidity, sentiment));
  const avgNoise = reports.reduce((s, r) => s + r.noiseLevel, 0) / Math.max(1, reports.length);
  const marketNoise = Math.round(avgNoise);
  const marketStability = 100 - marketNoise;
  const overreactionRisk = Math.round(
    Math.min(100, avgNoise * 0.6 + Math.abs(sentiment.score - 50) * 0.5),
  );
  const note =
    marketStability >= 70 ? "Stable conditions — signals can be trusted near face value." :
    marketStability >= 50 ? "Moderate noise — apply caution adjustment to confidence." :
    "Chaotic conditions — discount aggressive setups and shrink size.";
  return { reports, summary: { marketNoise, marketStability, overreactionRisk, note } };
}
