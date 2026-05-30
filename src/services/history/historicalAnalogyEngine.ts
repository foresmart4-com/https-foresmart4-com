// Phase-89C: Historical Analogy Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from historicalLearning.ts (Phase-74):
//   historicalLearning: keyword-based match → best single episode from registry
//   historicalAnalogyEngine (89C): MULTI-DIMENSIONAL SIMILARITY SCORING across
//                                   5 structural dimensions → analog confidence
//                                   score → dominant historical era classification
//
// Distinct from historicalAnalogEngine.ts (Phase-83A):
//   historicalAnalogEngine: compares against specific episodes with false-analog risk
//   historicalAnalogyEngine (89C): scores current conditions against ERA-LEVEL patterns
//                                   (1970s stagflation vs 1994 vs 2008 vs 2022) using
//                                   structured quantitative dimensions
//
// 5 similarity dimensions (each 0-100):
//   regime_similarity:    how similar is the macro regime to historical parallels?
//   policy_similarity:    how similar is the CB/policy posture?
//   credit_similarity:    how similar is the credit/spread environment?
//   commodity_similarity: how similar is the commodity price environment?
//   volatility_similarity: how similar is the vol/risk regime?
//
// Composite analog confidence (weighted):
//   regime 30% + policy 25% + credit 20% + commodity 15% + volatility 10%
//
// Dominant era classification (9 eras):
//   1970s_stagflation, 1994_tightening, 1998_ltcm, 2000_bear,
//   2008_gfc, 2013_taper, 2020_covid_shock, 2022_tightening, 2014_oil_collapse
//
// Analog strength: strong_analog (≥70), partial_analog (40-69), weak_analog (<40)
//
// whatDiffers: explicit structural differences stated — MANDATORY for any non-weak analog.
// Never omit whatDiffers: all history is context not prediction.
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type HistoricalEra =
  | "1970s_stagflation"
  | "1994_tightening"
  | "1998_ltcm"
  | "2000_bear"
  | "2008_gfc"
  | "2013_taper"
  | "2020_covid_shock"
  | "2022_tightening"
  | "2014_oil_collapse"
  | "neutral";

export type AnalogyStrength = "strong_analog" | "partial_analog" | "weak_analog";

export interface SimilarityDimensions {
  regime:    number;  // 0-100
  policy:    number;
  credit:    number;
  commodity: number;
  volatility: number;
}

export interface HistoricalAnalogyResult {
  dominantEra:     HistoricalEra;
  analogConfidence: number;        // 0-100 composite
  strength:        AnalogyStrength;
  dimensions:      SimilarityDimensions;
  eraContext:      string;         // ≤60 chars: what was this era about
  whatDiffers:     string;         // ≤65 chars: key difference from current — ALWAYS present
  analogCtx:       string;         // ≤180 chars injectable
}

// ─── Era signatures ───────────────────────────────────────────────────────────
// Each era is defined by its characteristic dimension scores
// Used for nearest-era classification

interface EraSig {
  era:      HistoricalEra;
  regime:   number; // expected score profile
  policy:   number;
  credit:   number;
  commodity: number;
  vol:      number;
  context:  string; // ≤60 chars
  differs:  string; // ≤65 chars: what makes current different by default
}

const ERA_SIGNATURES: EraSig[] = [
  { era: "1970s_stagflation", regime: 55, policy: 50, credit: 30, commodity: 85, vol: 60,
    context: "Oil supply shock + policy credibility loss + wage-price spiral",
    differs:  "Modern CBs act pre-emptively; labor markets are less unionised" },
  { era: "1994_tightening",   regime: 65, policy: 80, credit: 25, commodity: 20, vol: 35,
    context: "Surprise Fed tightening → EM rate shock → bond market selloff",
    differs:  "Current cycle started from near-zero rates; 1994 had less CB transparency" },
  { era: "1998_ltcm",         regime: 40, policy: 30, credit: 90, commodity: 40, vol: 90,
    context: "Liquidity crisis + credit contagion + forced deleveraging cascade",
    differs:  "CB backstop mechanism is now faster and larger (pre-positioned QE)" },
  { era: "2000_bear",         regime: 60, policy: 55, credit: 40, commodity: 25, vol: 65,
    context: "Valuation unwind after technology/narrative-driven multiple expansion",
    differs:  "Current valuations embed more earnings — PE 60-80x was pure narrative" },
  { era: "2008_gfc",          regime: 35, policy: 30, credit: 95, commodity: 45, vol: 95,
    context: "Systemic banking stress + housing collapse + global credit contraction",
    differs:  "Bank capital ratios far higher today; CB toolkit is pre-deployed" },
  { era: "2013_taper",        regime: 65, policy: 70, credit: 20, commodity: 35, vol: 40,
    context: "Fed tapering signal → EM capital outflow → DXY spike → EM selloff",
    differs:  "Current EM external debt is denominated differently; CB guidance more explicit" },
  { era: "2020_covid_shock",  regime: 30, policy: 20, credit: 80, commodity: 55, vol: 95,
    context: "Exogenous demand destruction + CB/fiscal response → fastest recovery on record",
    differs:  "No structural CB credibility issue; recovery driven by fiscal + vaccine timing" },
  { era: "2022_tightening",   regime: 50, policy: 90, credit: 45, commodity: 80, vol: 55,
    context: "Fastest CB hiking cycle since Volcker + energy shock + post-COVID re-pricing",
    differs:  "Started from zero rates; transmission lags make current cycle harder to map" },
  { era: "2014_oil_collapse",  regime: 45, policy: 40, credit: 35, commodity: 90, vol: 55,
    context: "OPEC supply decision → oil -65% → Saudi fiscal deficit → GCC credit tightening",
    differs:  "Saudi PIF and Vision 2030 framework did not exist; SAMA had larger reserves" },
];

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreRegimeSimilarity(regime: string, macroBias: "bullish" | "bearish" | "neutral"): number {
  const l = (regime ?? "").toLowerCase().replace(/[-\s]/g, "_");
  if (/high_vol_risk_off/.test(l) && macroBias === "bearish") return 85;
  if (/bear.*rang/.test(l))                                   return 70;
  if (/macro_transition/.test(l))                             return 55;
  if (/bull.*trend/.test(l) && macroBias === "bullish")       return 40;
  return 50;
}

function scorePolicySimilarity(ratesEnv: string, tltChangePct: number | null | undefined): number {
  const r = ratesEnv.toLowerCase();
  if (/aggressive.hike|75bps|100bps|volcker/.test(r))         return 90;
  if (/hawkish|restrict|tightening/.test(r))                  return 72;
  if (/on.hold|pause|stable/.test(r))                         return 45;
  if (/dovish|cut|easing|pivot/.test(r))                      return 25;
  if (tltChangePct != null && tltChangePct < -2)              return 80;
  if (tltChangePct != null && tltChangePct > 1.5)             return 20;
  return 50;
}

function scoreCreditSimilarity(creditStress: "low" | "moderate" | "high" | "extreme"): number {
  return { extreme: 90, high: 68, moderate: 40, low: 15 }[creditStress] ?? 40;
}

function scoreCommoditySimilarity(
  oilChangePct: number | null | undefined,
  oilPrice:     number | null | undefined,
): number {
  if (oilChangePct == null) return 30;
  const absChange = Math.abs(oilChangePct);
  if (absChange >= 6) return 88;
  if (absChange >= 3) return 68;
  if (absChange >= 1.5) return 45;
  if (oilPrice != null && oilPrice < 65) return 75;
  if (oilPrice != null && oilPrice > 95) return 70;
  return 25;
}

function scoreVolatilitySimilarity(
  macroBias:    "bullish" | "bearish" | "neutral",
  creditStress: "low" | "moderate" | "high" | "extreme",
  spyChangePct: number | null | undefined,
): number {
  let score = 30;
  if (creditStress === "extreme" || creditStress === "high") score += 35;
  if (macroBias === "bearish") score += 20;
  if (spyChangePct != null && spyChangePct < -2)             score += 20;
  return Math.min(95, score);
}

// ─── Dominant era classification ──────────────────────────────────────────────

function findDominantEra(dims: SimilarityDimensions): EraSig {
  let best: EraSig = ERA_SIGNATURES[0];
  let bestDist = Infinity;

  for (const sig of ERA_SIGNATURES) {
    // Euclidean distance in 5-D space
    const dist = Math.sqrt(
      Math.pow(dims.regime    - sig.regime,    2) * 0.30 +
      Math.pow(dims.policy    - sig.policy,    2) * 0.25 +
      Math.pow(dims.credit    - sig.credit,    2) * 0.20 +
      Math.pow(dims.commodity - sig.commodity, 2) * 0.15 +
      Math.pow(dims.volatility - sig.vol,      2) * 0.10
    );
    if (dist < bestDist) { bestDist = dist; best = sig; }
  }
  return best;
}

// ─── Composite confidence ─────────────────────────────────────────────────────

function computeConfidence(dims: SimilarityDimensions, bestDist: number): number {
  // Weighted average of dimension scores
  const weighted =
    dims.regime    * 0.30 +
    dims.policy    * 0.25 +
    dims.credit    * 0.20 +
    dims.commodity * 0.15 +
    dims.volatility * 0.10;
  // Discount by distance from nearest era signature
  const distPenalty = Math.min(30, Math.round(bestDist / 3));
  return Math.max(10, Math.min(92, Math.round(weighted) - distPenalty));
}

function classifyStrength(confidence: number): AnalogyStrength {
  if (confidence >= 68) return "strong_analog";
  if (confidence >= 40) return "partial_analog";
  return "weak_analog";
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildAnalogyCtx(
  era: EraSig,
  confidence: number,
  strength: AnalogyStrength,
): string {
  const label = strength === "strong_analog" ? "STRONG" : strength === "partial_analog" ? "PARTIAL" : "WEAK";
  return `Analog[${era.era}|${label}|${confidence}%]: ${era.context.slice(0, 55)} | Differs: ${era.differs.slice(0, 55)}`.slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildHistoricalAnalogy(input: {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  ratesEnv:          string;
  oilChangePct?:     number | null;
  oilPrice?:         number | null;
  tltChangePct?:     number | null;
  spyChangePct?:     number | null;
}): HistoricalAnalogyResult {
  const { regime, macroBias, creditStressLevel, ratesEnv, oilChangePct, oilPrice, tltChangePct, spyChangePct } = input;

  const dims: SimilarityDimensions = {
    regime:    scoreRegimeSimilarity(regime, macroBias),
    policy:    scorePolicySimilarity(ratesEnv, tltChangePct),
    credit:    scoreCreditSimilarity(creditStressLevel),
    commodity: scoreCommoditySimilarity(oilChangePct, oilPrice),
    volatility: scoreVolatilitySimilarity(macroBias, creditStressLevel, spyChangePct),
  };

  const best       = findDominantEra(dims);
  const dist       = Math.sqrt(
    Math.pow(dims.regime    - best.regime,    2) * 0.30 +
    Math.pow(dims.policy    - best.policy,    2) * 0.25 +
    Math.pow(dims.credit    - best.credit,    2) * 0.20 +
    Math.pow(dims.commodity - best.commodity, 2) * 0.15 +
    Math.pow(dims.volatility - best.vol,      2) * 0.10
  );
  const confidence = computeConfidence(dims, dist);
  const strength   = classifyStrength(confidence);

  return {
    dominantEra:      best.era,
    analogConfidence: confidence,
    strength,
    dimensions:       dims,
    eraContext:       best.context,
    whatDiffers:      best.differs,
    analogCtx:        buildAnalogyCtx(best, confidence, strength),
  };
}
