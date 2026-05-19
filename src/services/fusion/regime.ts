// Market regime classification, volatility state, and macroeconomic overlay.

import type { MacroOverlay, OHLC, RegimeName, RegimeSnapshot, VolatilityState } from "./types";
import { fusionBus } from "./eventBus";

function returns(bars: OHLC[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < bars.length; i++) r.push(Math.log(bars[i].c / bars[i - 1].c));
  return r;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function slope(xs: number[]): number {
  if (xs.length < 2) return 0;
  const n = xs.length;
  const sx = (n - 1) * n / 2;
  const sx2 = (n - 1) * n * (2 * n - 1) / 6;
  let sy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sy += xs[i]; sxy += i * xs[i]; }
  return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
}

export function classifyVolatility(bars: OHLC[]): VolatilityState {
  const r = returns(bars.slice(-60));
  const sd = stdev(r) * Math.sqrt(252);
  if (sd < 0.10) return "compressed";
  if (sd < 0.25) return "normal";
  if (sd < 0.50) return "elevated";
  return "explosive";
}

export function classifyRegime(symbol: string, bars: OHLC[]): RegimeSnapshot {
  const closes = bars.map((b) => b.c);
  const recent = closes.slice(-50);
  const trend = slope(recent.map((c) => Math.log(c)));            // log-slope per bar
  const sd = stdev(returns(bars.slice(-60)));
  const range = (Math.max(...recent) - Math.min(...recent)) / (recent.at(-1) ?? 1);
  const drawdown = (Math.max(...recent) - (recent.at(-1) ?? 0)) / Math.max(...recent || [1]);

  let regime: RegimeName = "ranging";
  if (sd > 0.04 && trend < -0.001) regime = "panic";
  else if (trend > 0.004 && sd < 0.02) regime = "euphoria";
  else if (trend > 0.002) regime = "trending_bull";
  else if (trend < -0.002) regime = "trending_bear";
  else if (drawdown > 0.10 && trend > 0) regime = "recovery";
  else if (range > 0.05 && sd > 0.025) regime = "volatile";
  else regime = "ranging";

  const vol = classifyVolatility(bars);
  const trendStrength = Math.max(-1, Math.min(1, trend * 250));
  const stability = 1 - Math.min(1, sd * 25);
  const snapshot: RegimeSnapshot = {
    symbol,
    regime,
    volatility: vol,
    trendStrength: Math.round(trendStrength * 1000) / 1000,
    confidence: Math.round(((0.5 * Math.abs(trendStrength)) + 0.5 * stability) * 1000) / 1000,
    updatedAt: Date.now(),
  };
  fusionBus.emit({ type: "regime", snapshot });
  return snapshot;
}

/** Synthetic macro overlay (real wiring goes through provider connectors). */
let macroState: MacroOverlay = {
  dxy: 104.2, yields10y: 4.25, vix: 14.3, oilBrent: 82.1,
  inflationProxy: 2.9, riskOn: 0.2, updatedAt: Date.now(),
};

export function updateMacro(partial: Partial<MacroOverlay>): MacroOverlay {
  macroState = { ...macroState, ...partial, updatedAt: Date.now() };
  // derive risk-on: high VIX & yields = risk-off
  const yieldImpact = Math.max(-1, Math.min(1, (4.5 - macroState.yields10y) / 2));
  const vixImpact = Math.max(-1, Math.min(1, (18 - macroState.vix) / 12));
  macroState.riskOn = Math.round(((0.6 * vixImpact + 0.4 * yieldImpact)) * 1000) / 1000;
  fusionBus.emit({ type: "macro", overlay: macroState });
  return macroState;
}

export function getMacro(): MacroOverlay { return macroState; }

/** Apply macro overlay to a regime confidence score. */
export function adjustForMacro(snapshot: RegimeSnapshot, macro: MacroOverlay = macroState): RegimeSnapshot {
  const bias = macro.riskOn;
  let adj = snapshot.confidence;
  if (snapshot.regime === "trending_bull") adj *= (1 + bias * 0.2);
  else if (snapshot.regime === "trending_bear") adj *= (1 - bias * 0.2);
  return { ...snapshot, confidence: Math.max(0, Math.min(1, Math.round(adj * 1000) / 1000)) };
}
