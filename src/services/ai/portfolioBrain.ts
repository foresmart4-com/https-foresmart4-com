/** Portfolio brain — hedging suggestions, capital rotation, adaptive exposure. */
import type { Regime7 } from "./regimeBrain";

export interface PortfolioPosition { symbol: string; notional: number; beta?: number; sector?: string; }
export interface RotationPlan { from: string; to: string; pct: number; rationale: string; }
export interface HedgeSuggestion { instrument: string; notional: number; rationale: string; }

export function suggestExposure(equity: number, regime: Regime7, macroBias: number): number {
  const base: Record<Regime7, number> = {
    trending_bull: 0.7, recovery: 0.55, ranging: 0.45, trending_bear: 0.3,
    volatile: 0.3, risk_off: 0.2, panic: 0.1,
  };
  const macroAdj = Math.max(-0.15, Math.min(0.15, macroBias * 0.15));
  return Math.max(0.05, Math.min(0.85, base[regime] + macroAdj)) * equity;
}

export function suggestRotation(positions: PortfolioPosition[], regime: Regime7): RotationPlan[] {
  const out: RotationPlan[] = [];
  if (regime === "risk_off" || regime === "panic") {
    for (const p of positions) {
      if ((p.beta ?? 1) > 1.1)
        out.push({ from: p.symbol, to: "XAUUSD", pct: 0.25, rationale: "Rotate high-beta into gold" });
    }
  }
  if (regime === "trending_bull") {
    for (const p of positions) {
      if ((p.beta ?? 1) < 0.6)
        out.push({ from: p.symbol, to: "QQQ", pct: 0.2, rationale: "Rotate defensives into growth" });
    }
  }
  return out;
}

export function suggestHedges(netBeta: number, equity: number, regime: Regime7): HedgeSuggestion[] {
  if (Math.abs(netBeta) < 0.2 && regime !== "panic") return [];
  const notional = Math.min(0.3, Math.abs(netBeta) * 0.25) * equity;
  return [{
    instrument: netBeta > 0 ? "SPX-SHORT" : "SPX-LONG",
    notional,
    rationale: `Net beta ${netBeta.toFixed(2)} — neutralize directional risk`,
  }];
}
