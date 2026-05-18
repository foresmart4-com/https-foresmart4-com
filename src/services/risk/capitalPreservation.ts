/**
 * Capital Preservation — profit lock, trailing equity protection,
 * defensive mode, drawdown recovery and adaptive stop tightening.
 */

import type { Regime } from "./capitalManager";

export type DefensiveMode = "normal" | "cautious" | "defensive" | "frozen";

export interface EquityState {
  peakEquity: number;
  currentEquity: number;
  startEquity: number;
  trailingLockPct: number;   // e.g. 0.6 => lock 60% of profit
  drawdownPct: number;       // computed
}

export function computeEquityState(args: {
  history: { ts: number; equity: number }[];
  startEquity: number;
  trailingLockPct?: number;
}): EquityState {
  const peak = args.history.reduce((m, p) => Math.max(m, p.equity), args.startEquity);
  const current = args.history.at(-1)?.equity ?? args.startEquity;
  const dd = peak > 0 ? Math.max(0, (peak - current) / peak) : 0;
  return {
    peakEquity: peak,
    currentEquity: current,
    startEquity: args.startEquity,
    trailingLockPct: args.trailingLockPct ?? 0.6,
    drawdownPct: dd,
  };
}

export function protectedProfit(state: EquityState): number {
  const profit = Math.max(0, state.peakEquity - state.startEquity);
  return profit * state.trailingLockPct;
}

export function trailingEquityFloor(state: EquityState): number {
  return state.startEquity + protectedProfit(state);
}

export interface DefensiveDecision {
  mode: DefensiveMode;
  reduceExposurePct: number;     // 0-1 to reduce by
  stopTightenFactor: number;     // multiply stop distance, <1 means tighter
  freeze: boolean;
  reasons: string[];
}

export function evaluateDefensiveMode(args: {
  equity: EquityState;
  regime: Regime;
  volatility: number;            // realized
  consecutiveLosses: number;
  flashCrash: boolean;
}): DefensiveDecision {
  const reasons: string[] = [];
  let mode: DefensiveMode = "normal";
  let reduce = 0;
  let tighten = 1;
  let freeze = false;

  if (args.equity.drawdownPct > 0.04) { mode = "cautious"; reduce = 0.25; tighten = 0.85;
    reasons.push("Drawdown >4%"); }
  if (args.equity.drawdownPct > 0.08) { mode = "defensive"; reduce = 0.5; tighten = 0.7;
    reasons.push("Drawdown >8%"); }
  if (args.equity.drawdownPct > 0.12) { mode = "frozen"; reduce = 1; tighten = 0.5; freeze = true;
    reasons.push("Max drawdown breach — capital frozen"); }

  if (args.regime === "panic" || args.regime === "risk_off") {
    mode = mode === "normal" ? "defensive" : mode;
    reduce = Math.max(reduce, 0.5);
    tighten = Math.min(tighten, 0.7);
    reasons.push(`Regime ${args.regime}`);
  }
  if (args.flashCrash) { mode = "frozen"; freeze = true; reduce = 1;
    reasons.push("Flash-crash detected"); }
  if (args.consecutiveLosses >= 4) { mode = mode === "normal" ? "cautious" : mode;
    reduce = Math.max(reduce, 0.3); tighten = Math.min(tighten, 0.8);
    reasons.push("Loss streak"); }
  if (args.volatility > 0.06) { reduce = Math.max(reduce, 0.4); tighten = Math.min(tighten, 0.75);
    reasons.push("Extreme volatility"); }

  return { mode, reduceExposurePct: reduce, stopTightenFactor: tighten, freeze, reasons };
}
