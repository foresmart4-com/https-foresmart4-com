// Execution Timing Engine — evaluates whether *now* is a good moment to act,
// based on liquidity, volatility spikes, stress, breakout posture and news.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { BreakoutReport } from "@/services/edge/breakoutPrediction";
import type { LiquidityFlowReport } from "@/services/edge/liquidityFlow";
import type { MarketEvent } from "@/services/events/eventImpactEngine";

export type ExecutionRec = "execute-now" | "scale-in" | "wait" | "stand-aside";

export interface TimingReport {
  asset: AssetKey;
  assetName: string;
  executionQuality: number; // 0-100
  timingRisk: number;       // 0-100
  recommendation: ExecutionRec;
  factors: {
    liquidity: number;
    volatilitySpike: number;
    marketStress: number;
    breakoutTiming: number;
    newsRisk: number;
    noise: number;
  };
  note: string;
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

export function evaluateTiming(
  q: MarketQuote,
  regime: RegimeReport,
  breakout: BreakoutReport | undefined,
  liquidity: LiquidityFlowReport,
  events: MarketEvent[],
): TimingReport {
  // Liquidity proxy — higher when sector flow is decisive (not chaotic)
  const sectorShare = liquidity.sectors.reduce((s, x) => s + x.share, 0) || 1;
  const liquidityScore = Math.max(20, Math.min(100, Math.round(80 - liquidity.concentration * 0.4 + sectorShare * 0.05)));

  // Volatility spike — recent stdev vs prior
  const h = q.history;
  const recent = stdev(h.slice(-8));
  const prior  = stdev(h.slice(0, Math.max(8, h.length - 8))) || 1e-9;
  const spikeRatio = recent / prior;
  const volatilitySpike = Math.max(0, Math.min(100, Math.round((spikeRatio - 1) * 90)));

  const marketStress =
    regime.regime === "Panic" ? 90 :
    regime.regime === "High Volatility" ? 70 :
    regime.regime === "Risk-Off" ? 55 : 25;

  const breakoutTiming = breakout
    ? Math.round(breakout.squeeze * 0.5 + breakout.pressure * 0.3 + (breakout.direction === "neutral" ? 0 : 15))
    : 30;

  const highImpactNews = events.filter((e) => e.impact === "high").length;
  const newsRisk = Math.min(100, highImpactNews * 28 + (events.length > 4 ? 10 : 0));

  const noise = Math.min(100, Math.round(volatilitySpike * 0.5 + (100 - liquidityScore) * 0.4));

  const executionQuality = Math.max(0, Math.min(100, Math.round(
    liquidityScore * 0.3 + breakoutTiming * 0.25
    - volatilitySpike * 0.2 - marketStress * 0.25 - newsRisk * 0.15 - noise * 0.05 + 35,
  )));

  const timingRisk = Math.max(0, Math.min(100, Math.round(
    volatilitySpike * 0.3 + marketStress * 0.35 + newsRisk * 0.25 + noise * 0.1,
  )));

  let recommendation: ExecutionRec = "wait";
  if (executionQuality >= 70 && timingRisk < 45) recommendation = "execute-now";
  else if (executionQuality >= 55 && timingRisk < 60) recommendation = "scale-in";
  else if (timingRisk >= 75 || marketStress >= 80) recommendation = "stand-aside";

  const note = recommendation === "execute-now"
    ? "Conditions support measured execution — liquidity and structure aligned."
    : recommendation === "scale-in"
      ? "Acceptable backdrop — prefer partial, staged entries rather than full size."
      : recommendation === "stand-aside"
        ? "Conditions unfavourable — capital preservation outweighs opportunity."
        : "Wait for cleaner conditions; risk currently outweighs edge.";

  return {
    asset: q.key, assetName: q.name,
    executionQuality, timingRisk, recommendation,
    factors: { liquidity: liquidityScore, volatilitySpike, marketStress, breakoutTiming, newsRisk, noise },
    note,
  };
}

export function evaluateAllTiming(
  quotes: MarketQuote[],
  regime: RegimeReport,
  breakouts: BreakoutReport[],
  liquidity: LiquidityFlowReport,
  events: MarketEvent[],
): TimingReport[] {
  const brMap = new Map(breakouts.map((b) => [b.asset, b]));
  return quotes.map((q) => evaluateTiming(q, regime, brMap.get(q.key), liquidity, events));
}
