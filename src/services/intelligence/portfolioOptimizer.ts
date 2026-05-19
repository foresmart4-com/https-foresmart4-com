import type { ScannedAsset } from "./marketScanner";

export interface AllocationItem {
  symbol: string;
  name: string;
  klass: ScannedAsset["klass"];
  weight: number; // 0-1
  rationale: string;
}

export interface OptimizationResult {
  allocations: AllocationItem[];
  diversificationScore: number; // 0-100
  riskScore: number; // 0-100 (lower better)
  expectedReturnPct: number;
  rebalance: { symbol: string; from: number; to: number; action: "buy" | "sell" | "hold" }[];
}

export function optimize(assets: ScannedAsset[], current?: Record<string, number>): OptimizationResult {
  // Score = trend bias * confidence / volatility, clamp positive.
  const scored = assets.map((a) => {
    const trendBias = a.trend === "bullish" ? 1.2 : a.trend === "bearish" ? 0.4 : 0.8;
    const raw = (trendBias * a.confidence) / Math.max(15, a.volatility);
    return { a, score: Math.max(0.05, raw) };
  });
  // Cap per class to keep diversification.
  const classCap: Record<string, number> = { stocks: 0.45, crypto: 0.25, gold: 0.2, forex: 0.2, oil: 0.15 };
  const sumByClass: Record<string, number> = {};
  let total = scored.reduce((s, x) => s + x.score, 0) || 1;
  let weights = scored.map((x) => ({ ...x, w: x.score / total }));
  for (const w of weights) {
    sumByClass[w.a.klass] = (sumByClass[w.a.klass] ?? 0) + w.w;
  }
  // Rescale class overflows
  for (const klass of Object.keys(sumByClass)) {
    const cap = classCap[klass] ?? 0.3;
    if (sumByClass[klass] > cap) {
      const factor = cap / sumByClass[klass];
      weights = weights.map((w) => (w.a.klass === klass ? { ...w, w: w.w * factor } : w));
    }
  }
  total = weights.reduce((s, x) => s + x.w, 0) || 1;
  weights = weights.map((w) => ({ ...w, w: w.w / total }));

  const allocations: AllocationItem[] = weights
    .sort((x, y) => y.w - x.w)
    .slice(0, 10)
    .map(({ a, w }) => ({
      symbol: a.symbol, name: a.name, klass: a.klass,
      weight: +w.toFixed(4),
      rationale: `${a.trend} | conf ${a.confidence}% | vol ${a.volatility}%`,
    }));

  const allocSum = allocations.reduce((s, x) => s + x.weight, 0) || 1;
  for (const a of allocations) a.weight = +(a.weight / allocSum).toFixed(4);

  const classes = new Set(allocations.map((a) => a.klass));
  const diversificationScore = Math.min(100, classes.size * 22 + (allocations.length >= 6 ? 10 : 0));
  const wAvgVol =
    allocations.reduce((s, a) => {
      const v = assets.find((x) => x.symbol === a.symbol)?.volatility ?? 25;
      return s + v * a.weight;
    }, 0);
  const riskScore = Math.min(100, Math.round(wAvgVol));
  const expectedReturnPct = +allocations.reduce((s, a) => {
    const m = assets.find((x) => x.symbol === a.symbol)?.momentum ?? 0;
    return s + m * a.weight * 0.6;
  }, 0).toFixed(2);

  const rebalance = allocations.map((a) => {
    const from = current?.[a.symbol] ?? 0;
    const to = a.weight;
    const delta = to - from;
    return {
      symbol: a.symbol,
      from: +from.toFixed(4),
      to: +to.toFixed(4),
      action: Math.abs(delta) < 0.02 ? "hold" : delta > 0 ? "buy" : "sell",
    } as const;
  });

  return { allocations, diversificationScore, riskScore, expectedReturnPct, rebalance };
}
