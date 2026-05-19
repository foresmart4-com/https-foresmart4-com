// Multi-asset portfolio simulator.
import type { Bar } from "./simulationLab";
import { replayHistorical, type StrategyFn } from "./historicalReplay";
import { computeRiskMetrics, type EquityPoint, type RiskMetrics } from "./riskMetrics";

export interface PortfolioLeg {
  symbol: string;
  bars: Bar[];
  weight: number; // 0..1
  strategy: StrategyFn;
}

export interface PortfolioResult {
  equityCurve: EquityPoint[];
  metrics: RiskMetrics;
  perAsset: { symbol: string; weight: number; contributionPct: number; winRate: number; trades: number }[];
  diversificationScore: number; // 0..100 (effective N)
}

export function simulatePortfolio(legs: PortfolioLeg[], startEquity = 10_000): PortfolioResult {
  const totalWeight = legs.reduce((s, l) => s + l.weight, 0) || 1;
  const norm = legs.map((l) => ({ ...l, weight: l.weight / totalWeight }));
  const perResults = norm.map((leg) => ({
    leg, result: replayHistorical(leg.bars, leg.strategy, { startEquity: startEquity * leg.weight }),
  }));
  // Align curves by index (assume same length).
  const len = Math.min(...perResults.map((p) => p.result.equityCurve.length));
  const curve: EquityPoint[] = [];
  for (let i = 0; i < len; i++) {
    const ts = perResults[0].result.equityCurve[i].ts;
    const eq = perResults.reduce((s, p) => s + p.result.equityCurve[i].equity, 0);
    curve.push({ ts, equity: +eq.toFixed(2) });
  }
  const metrics = computeRiskMetrics(curve);
  const perAsset = perResults.map((p) => {
    const start = p.result.equityCurve[0]?.equity ?? 0;
    const end = p.result.equityCurve.at(-1)?.equity ?? 0;
    return {
      symbol: p.leg.symbol,
      weight: +p.leg.weight.toFixed(3),
      contributionPct: +(((end - start) / (startEquity || 1)) * 100).toFixed(2),
      winRate: p.result.winRate,
      trades: p.result.trades.length,
    };
  });
  const hhi = norm.reduce((s, l) => s + l.weight * l.weight, 0);
  const diversificationScore = +Math.max(0, Math.min(100, (1 / hhi / norm.length) * 100)).toFixed(1);
  return { equityCurve: curve, metrics, perAsset, diversificationScore };
}
