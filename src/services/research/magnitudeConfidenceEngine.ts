// Phase-87A: Magnitude Confidence Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Fixes the flat confidence logic in semanticImpactEngine.ts where a 0.1% TLT
// move gets the same confidence pressure score as a 5% TLT move.
//
// Magnitude tiers (primary signal):
//   minimal:  < 0.5%  → multiplier 0.35 (noise; no meaningful confidence impact)
//   small:    0.5-1.0% → multiplier 0.60 (below 1σ; moderate relevance)
//   medium:   1.0-2.5% → multiplier 0.85 (1-2σ; meaningful signal)
//   large:    2.5-5.0% → multiplier 1.10 (>2σ; significant event)
//   extreme:  > 5.0%  → multiplier 1.35 (tail event; maximum confidence impact)
//
// Regime intensity modifier:
//   stable regimes (low_vol, bull_trending):
//     Same-size move is MORE significant → multiplier ×1.15
//     (markets are calibrated to calm; unusual moves carry more information)
//   volatile regimes (high_vol, risk_off, macro_transition):
//     Same-size move is LESS significant → multiplier ×0.85
//     (volatility is already priced; individual moves carry less new information)
//
// Signal corroboration bonus:
//   Multiple corroborating signals (e.g., TLT down + gold up + SPY down)
//   increase confidence impact: 2 signals +15%, 3+ signals +25%.
//
// Output: magnitudeAdjustedConfidence (0-100)
//
// Used by: semanticImpactEngine.ts to replace flat EVENT_CONFIDENCE_IMPACT lookups.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MagnitudeTier =
  | "minimal"   // < 0.5%
  | "small"     // 0.5-1.0%
  | "medium"    // 1.0-2.5%
  | "large"     // 2.5-5.0%
  | "extreme";  // > 5.0%

export interface MagnitudeConfidenceInput {
  primaryMagnitudePct: number;        // primary signal magnitude (abs value)
  corroboratingCount:  number;        // 0-3+: how many corroborating signals
  regimeLabel?:        string;        // current macro regime label
  baseConfidence?:     number;        // 0-100: starting base from event type
}

export interface MagnitudeConfidenceResult {
  tier:                     MagnitudeTier;
  tierMultiplier:           number;
  regimeMultiplier:         number;
  corroborationBonus:       number;
  magnitudeAdjustedConfidence: number; // 0-100: final output
}

// ─── Magnitude tier classification ────────────────────────────────────────────

export function classifyMagnitudeTier(pct: number): MagnitudeTier {
  const abs = Math.abs(pct);
  if (abs < 0.5)  return "minimal";
  if (abs < 1.0)  return "small";
  if (abs < 2.5)  return "medium";
  if (abs < 5.0)  return "large";
  return "extreme";
}

const TIER_MULTIPLIER: Record<MagnitudeTier, number> = {
  minimal: 0.35,
  small:   0.60,
  medium:  0.85,
  large:   1.10,
  extreme: 1.35,
};

// ─── Regime intensity classification ─────────────────────────────────────────

function getRegimeMultiplier(regime?: string): number {
  if (!regime) return 1.0;
  // Use includes/test without \b — regime labels use underscores, not word boundaries
  const r = regime.toLowerCase();
  if (/low.vol|bull.trending|goldilocks|low.inflation/.test(r)) return 1.15;
  if (/high.vol|risk.off|macro.transition|stagflation|extreme/.test(r)) return 0.85;
  return 1.0;
}

// ─── Corroboration bonus ──────────────────────────────────────────────────────

function getCorroborationBonus(count: number): number {
  if (count >= 3) return 0.25;
  if (count >= 2) return 0.15;
  return 0.0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeMagnitudeAdjustedConfidence(
  input: MagnitudeConfidenceInput,
): MagnitudeConfidenceResult {
  const {
    primaryMagnitudePct,
    corroboratingCount = 0,
    regimeLabel,
    baseConfidence = 50,
  } = input;

  const tier              = classifyMagnitudeTier(primaryMagnitudePct);
  const tierMultiplier    = TIER_MULTIPLIER[tier];
  const regimeMultiplier  = getRegimeMultiplier(regimeLabel);
  const corroborationBonus = getCorroborationBonus(corroboratingCount);

  const raw = baseConfidence * tierMultiplier * regimeMultiplier * (1 + corroborationBonus);
  const magnitudeAdjustedConfidence = Math.min(100, Math.max(0, Math.round(raw)));

  return {
    tier,
    tierMultiplier,
    regimeMultiplier,
    corroborationBonus,
    magnitudeAdjustedConfidence,
  };
}

/** Convenience: count corroborating signals from a set of present/absent indicators. */
export function countCorroboratingSaignals(signals: {
  tltDown?: boolean;
  tltUp?: boolean;
  spyDown?: boolean;
  spyUp?: boolean;
  goldUp?: boolean;
  oilDown?: boolean;
  oilUp?: boolean;
}): number {
  const { tltDown, tltUp, spyDown, spyUp, goldUp, oilDown, oilUp } = signals;
  // Corroboration requires ≥2 confirming signals — single signal = 0 corroboration
  const riskOff = [tltDown, spyDown, goldUp].filter(Boolean).length;
  const rateCut  = [tltUp, spyUp].filter(Boolean).length;
  const oilCorr  = (oilDown && spyDown) || (oilUp && spyUp) ? 2 : 0;
  // Only counts when ≥2 signals confirm the same narrative
  return Math.max(
    riskOff >= 2 ? riskOff : 0,
    rateCut >= 2 ? rateCut : 0,
    oilCorr,
  );
}
