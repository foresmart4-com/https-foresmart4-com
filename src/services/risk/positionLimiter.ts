/**
 * Position Limiter — Kelly + confidence + volatility scaled sizing.
 * Strictly capped; never recommends leverage.
 */

import type { Regime } from "./capitalManager";

export interface SizingInput {
  equity: number;
  confidence: number;       // 0-1
  winRate: number;          // 0-1
  avgWin: number;           // % expected gain
  avgLoss: number;          // % expected loss (positive number)
  volatility: number;       // realized vol % e.g. 0.02 = 2%
  liquidityScore: number;   // 0-1 (1 = deep liquidity)
  regime: Regime;
  perTradeCap: number;      // hard cap in quote currency
}

export interface SizingResult {
  notional: number;
  fraction: number;         // 0-1 of equity
  kellyFraction: number;
  reasons: string[];
}

const REGIME_RISK_SCALE: Record<Regime, number> = {
  trending_bull: 1.0,
  recovery: 0.8,
  ranging: 0.65,
  neutral: 0.65,
  trending_bear: 0.45,
  volatile: 0.4,
  risk_off: 0.25,
  panic: 0.1,
};

export function smartPositionSize(input: SizingInput): SizingResult {
  const reasons: string[] = [];
  const safeWin = Math.max(0.001, input.avgWin);
  const safeLoss = Math.max(0.001, input.avgLoss);
  const b = safeWin / safeLoss;
  const p = Math.min(0.95, Math.max(0.05, input.winRate));
  const q = 1 - p;
  // Kelly: f* = (bp - q) / b
  const rawKelly = (b * p - q) / b;
  const kelly = Math.max(0, Math.min(0.25, rawKelly)); // hard cap 25%

  // Fractional Kelly (1/4) scaled by confidence
  let fraction = kelly * 0.25 * Math.min(1, Math.max(0, input.confidence));

  // Volatility scaling: target 1.5% vol budget
  const volTarget = 0.015;
  const volScale = Math.min(1.5, volTarget / Math.max(0.003, input.volatility));
  fraction *= volScale;
  if (volScale < 1) reasons.push("Volatility scaled down");

  // Liquidity throttle
  fraction *= Math.min(1, Math.max(0.2, input.liquidityScore));
  if (input.liquidityScore < 0.6) reasons.push("Low liquidity throttle");

  // Regime scale
  const regScale = REGIME_RISK_SCALE[input.regime] ?? 0.6;
  fraction *= regScale;
  if (regScale < 0.5) reasons.push(`Regime ${input.regime} — defensive`);

  // Final clamp
  fraction = Math.max(0, Math.min(0.08, fraction)); // never more than 8% per trade
  if (fraction === 0.08) reasons.push("Per-trade hard cap applied");

  let notional = fraction * input.equity;
  if (notional > input.perTradeCap) {
    notional = input.perTradeCap;
    reasons.push("Capital manager per-trade cap applied");
  }

  return { notional, fraction, kellyFraction: kelly, reasons };
}
