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

// ---------- Probabilistic blend (Phase 4) ----------

export interface RegimeBlend {
  primary: Regime7;
  secondary: Regime7 | null;
  primaryConf: number;  // 0-100
  label: string;        // human-readable, e.g. "panic" or "volatile/risk_off transition"
}

/** Score how strongly each regime condition fires given the input signals. */
function regimeScores(input: { trendPct: number; volatility: number; drawdownPct: number; breadth: number }): Array<{ regime: Regime7; score: number }> {
  const { trendPct, volatility, drawdownPct, breadth } = input;
  return [
    { regime: "panic",        score: Math.min(volatility / 0.07, 1) * Math.min(drawdownPct / 0.1, 1) },
    { regime: "risk_off",     score: Math.max(0, Math.min(drawdownPct / 0.06, 1) * Math.min((0.3 - breadth) / 0.3, 1)) },
    { regime: "volatile",     score: Math.min(volatility / 0.045, 1) },
    { regime: "trending_bull",score: Math.max(0, Math.min(trendPct / 0.03, 1) * Math.min(breadth / 0.6, 1)) },
    { regime: "trending_bear",score: Math.max(0, Math.min(-trendPct / 0.03, 1) * Math.min((0.4 - breadth) / 0.4, 1)) },
    { regime: "recovery",     score: Math.max(0, Math.min((0.03 - drawdownPct) / 0.03, 1) * Math.min(trendPct / 0.01, 1)) },
    { regime: "ranging",      score: 0.3 }, // baseline when nothing else fires strongly
  ].sort((a, b) => b.score - a.score);
}

/**
 * Returns a probabilistic regime blend. When two regimes score closely,
 * surfaces a transition label instead of forcing a single classification.
 */
export function classifyRegimeBlend(input: {
  trendPct: number;
  volatility: number;
  drawdownPct: number;
  breadth: number;
}): RegimeBlend {
  const scores = regimeScores(input);
  const top = scores[0] ?? { regime: "ranging" as Regime7, score: 0.3 };
  const next = scores[1] ?? { regime: "ranging" as Regime7, score: 0 };

  const totalTop2 = top.score + next.score || 1;
  const primaryConf = Math.min(95, Math.round((top.score / totalTop2) * 100));

  // Secondary regime is meaningful when it fires at ≥50% of the primary score
  const secondary: Regime7 | null =
    next.score >= top.score * 0.5 && next.score > 0.15 ? next.regime : null;

  const label = secondary
    ? `${top.regime}/${secondary} transition`
    : top.regime;

  return { primary: top.regime, secondary, primaryConf, label };
}
