/** Regime brain — 7-state classifier from realized stats. */
export type Regime7 =
  | "trending_bull" | "trending_bear" | "ranging" | "volatile"
  | "panic" | "risk_off" | "recovery";

export function classifyRegime(input: {
  trendPct: number;       // e.g. 5d return
  volatility: number;     // realized
  drawdownPct: number;    // from recent peak
  breadth: number;        // % advancing
}): { regime: Regime7; confidence: number } {
  const { trendPct, volatility, drawdownPct, breadth } = input;
  if (volatility > 0.07 && drawdownPct > 0.1) return { regime: "panic", confidence: 0.92 };
  if (drawdownPct > 0.06 && breadth < 0.3)     return { regime: "risk_off", confidence: 0.8 };
  if (volatility > 0.045)                       return { regime: "volatile", confidence: 0.75 };
  if (trendPct > 0.03 && breadth > 0.6)         return { regime: "trending_bull", confidence: 0.85 };
  if (trendPct < -0.03 && breadth < 0.4)        return { regime: "trending_bear", confidence: 0.82 };
  if (drawdownPct < 0.03 && trendPct > 0.01)    return { regime: "recovery", confidence: 0.7 };
  return { regime: "ranging", confidence: 0.6 };
}
