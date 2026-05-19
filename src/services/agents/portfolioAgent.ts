// Portfolio Intelligence Agent — concentration, correlated exposure and
// allocation optimisation suggestions on top of the existing PortfolioReport.
import type { AgentContext, AgentSignal } from "./types";

export function runPortfolioAgent({ intel }: AgentContext): AgentSignal & {
  allocation: { asset: string; current: number; suggested: number; delta: number }[];
} {
  const p = intel.portfolio;
  const drivers: string[] = [
    `Concentration HHI ${p.concentration}/100`,
    `Correlated exposure ${p.correlatedExposure}/100`,
    `Risk score ${p.riskScore}/100`,
  ];
  const flags: string[] = [...p.warnings];

  // Suggested allocation: blend current weight with confidence-tilted target
  const total = p.positions.reduce((s, x) => s + x.weight, 0) || 1;
  const sigMap = new Map(intel.signals.map((s) => [s.asset, s]));
  const ranked = p.positions.map((pos) => {
    const sig = sigMap.get(pos.asset);
    const desire = sig ? (sig.action === "BUY" ? sig.confidence : sig.action === "SELL" ? 100 - sig.confidence : 50) : 50;
    return { pos, desire };
  });
  const totalDesire = ranked.reduce((s, x) => s + x.desire, 0) || 1;
  const allocation = ranked.map(({ pos, desire }) => {
    const target = (desire / totalDesire);
    const cap = Math.min(0.35, Math.max(0.04, target)); // institutional 4–35% caps
    const current = pos.weight / total;
    return {
      asset: pos.asset,
      current: +(current * 100).toFixed(1),
      suggested: +(cap * 100).toFixed(1),
      delta: +((cap - current) * 100).toFixed(1),
    };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Diversification quality (inverse HHI normalised)
  const divQuality = Math.max(0, 100 - p.concentration);
  const score = Math.max(-100, Math.min(100, divQuality - p.correlatedExposure * 0.6 - p.riskScore * 0.3));
  const bias = score > 10 ? "bullish" : score < -10 ? "bearish" : "neutral";
  const confidence = Math.min(95, 55 + Math.abs(score) * 0.3);

  return {
    id: "portfolio", label: "Portfolio Intelligence",
    bias, score, confidence, weight: 0.1,
    headline: bias === "bearish"
      ? "Portfolio structure stretched — rebalance suggested"
      : "Portfolio structure within institutional bands",
    drivers, flags, allocation,
  };
}
