// Test a strategy across multiple market regimes.
import { generateBars, type RegimeName } from "./syntheticData";
import { replayHistorical, type StrategyFn, type ReplayResult } from "./historicalReplay";

export interface RegimeResult {
  regime: RegimeName;
  result: ReplayResult;
  rating: "strong" | "neutral" | "weak";
}

export interface RegimeTestReport {
  results: RegimeResult[];
  robustness: number; // 0..100 — consistency across regimes
  bestRegime: RegimeName;
  worstRegime: RegimeName;
}

export function testAcrossRegimes(
  strategy: StrategyFn,
  opts: { bars?: number; seed?: number } = {},
): RegimeTestReport {
  const { bars = 252, seed = 7 } = opts;
  const regimes: RegimeName[] = ["bull", "bear", "chop", "volatile", "crisis"];
  const results: RegimeResult[] = regimes.map((r, idx) => {
    const data = generateBars({ bars, regime: r, seed: seed + idx });
    const result = replayHistorical(data, strategy);
    const score = result.metrics.totalReturnPct;
    const rating: RegimeResult["rating"] =
      score > 5 ? "strong" : score > -3 ? "neutral" : "weak";
    return { regime: r, result, rating };
  });
  const returns = results.map((r) => r.result.metrics.totalReturnPct);
  const mean = returns.reduce((s, x) => s + x, 0) / returns.length;
  const variance = returns.reduce((s, x) => s + (x - mean) ** 2, 0) / returns.length;
  const robustness = +Math.max(0, 100 - Math.sqrt(variance) * 2).toFixed(1);
  const sorted = [...results].sort((a, b) => b.result.metrics.totalReturnPct - a.result.metrics.totalReturnPct);
  return {
    results,
    robustness,
    bestRegime: sorted[0].regime,
    worstRegime: sorted.at(-1)!.regime,
  };
}
