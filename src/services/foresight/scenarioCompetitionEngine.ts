// Phase-88B: Scenario Competition Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Problem: Genesis builds one dominant view and produces 3 generic scenarios
// as afterthoughts. Institutional foresight requires competing scenarios with
// explicitly weighted probabilities and observable trigger conditions BEFORE
// the AI constructs its answer — so the AI's scenarios are grounded in
// pre-computed competition logic rather than improvised in the moment.
//
// Solution: deterministic competing scenario profiles from regime + signals.
// bull / base / bear sum to 100. An alternative "tail path" is added when
// regime is macro_transition or credit stress is extreme.
//
// Probability table is regime × bias driven, then adjusted for:
//   credit stress high/extreme: -8 from bull, +8 to bear
//   oilPrice < $75 + isSaudi: -5 from bull (Saudi fiscal pressure)
//   oilPrice > $85 + isSaudi: +5 to bull (Saudi fiscal surplus channel)
//   competition intensity: high if max−min < 25 pts; low if dominant > 65 pts
//
// Output: ScenarioCompetitionProfile with injectable foresightContext (≤220 chars).
// No execution language. Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type ScenarioBias = "bull" | "base" | "bear" | "alternative";

export interface CompetingScenario {
  label:             string;  // e.g. "Pivot Acceleration"
  trigger:           string;  // "If [observable condition]..."
  probability:       number;  // 0-100
  macroImplication:  string;  // ≤72 chars: directional implication
  keyRisk:           string;  // ≤60 chars: what invalidates this scenario
}

export interface ScenarioCompetitionProfile {
  bull:                  CompetingScenario;
  base:                  CompetingScenario;
  bear:                  CompetingScenario;
  alternative?:          CompetingScenario;  // tail path when macro_transition or extreme stress
  dominantScenario:      ScenarioBias;
  competitionIntensity:  "high" | "moderate" | "low";
  foresightContext:      string;  // ≤220 chars injectable
  probabilitySum:        number;  // should be 100 (checked by governor)
}

// ─── Regime × bias probability table ─────────────────────────────────────────

type PrimaryRegimeKey =
  | "bull_trending"
  | "bear_ranging"
  | "high_vol_risk_off"
  | "low_vol_accumulation"
  | "macro_transition";

type BiasTier = "bullish" | "neutral" | "bearish";

interface ProbTable { bull: number; base: number; bear: number; }

const PROB_TABLE: Record<PrimaryRegimeKey, Record<BiasTier, ProbTable>> = {
  bull_trending: {
    bullish: { bull: 45, base: 35, bear: 20 },
    neutral: { bull: 38, base: 38, bear: 24 },
    bearish: { bull: 28, base: 40, bear: 32 },
  },
  low_vol_accumulation: {
    bullish: { bull: 42, base: 40, bear: 18 },
    neutral: { bull: 35, base: 42, bear: 23 },
    bearish: { bull: 25, base: 42, bear: 33 },
  },
  macro_transition: {
    bullish: { bull: 32, base: 38, bear: 30 },
    neutral: { bull: 28, base: 38, bear: 34 },
    bearish: { bull: 22, base: 36, bear: 42 },
  },
  bear_ranging: {
    bullish: { bull: 30, base: 38, bear: 32 },
    neutral: { bull: 22, base: 38, bear: 40 },
    bearish: { bull: 14, base: 32, bear: 54 },
  },
  high_vol_risk_off: {
    bullish: { bull: 22, base: 35, bear: 43 },
    neutral: { bull: 16, base: 32, bear: 52 },
    bearish: { bull: 10, base: 28, bear: 62 },
  },
};

// ─── Scenario templates ───────────────────────────────────────────────────────

interface ScenarioTemplate {
  bull: Omit<CompetingScenario, "probability">;
  base: Omit<CompetingScenario, "probability">;
  bear: Omit<CompetingScenario, "probability">;
  alternative?: Omit<CompetingScenario, "probability">;
}

const SAUDI_TEMPLATE: ScenarioTemplate = {
  bull: {
    label:            "Fiscal Expansion Path",
    trigger:          "If oil holds above $80 and SAMA eases alongside the Fed",
    macroImplication: "Saudi credit expansion → TASI re-rating → NIM improvement for banks",
    keyRisk:          "Oil demand slowdown breaks fiscal support mechanism",
  },
  base: {
    label:            "Managed Stability",
    trigger:          "If oil oscillates $70-85 and Vision 2030 capex sustains",
    macroImplication: "Moderate credit growth; TASI range-bound with sector divergence",
    keyRisk:          "Budget pressure if Brent falls below $75 sustained breakeven",
  },
  bear: {
    label:            "Fiscal Contraction",
    trigger:          "If oil falls below $70 for 2+ months and global demand contracts",
    macroImplication: "Government spending cut → bank NIM compression → real estate softening",
    keyRisk:          "Aramco dividend sustainability questioned at sub-$65 oil",
  },
};

const GLOBAL_TEMPLATE: ScenarioTemplate = {
  bull: {
    label:            "Soft Landing + Pivot",
    trigger:          "If inflation normalizes to target and CB signals rate cuts",
    macroImplication: "Multiple expansion → growth re-rating → credit spread tightening",
    keyRisk:          "Second inflation wave reignites before cuts materialise",
  },
  base: {
    label:            "Higher-for-Longer Plateau",
    trigger:          "If inflation sticky above 3% and CB holds restrictive stance",
    macroImplication: "Compressed multiples; credit tightens; earnings revisions lower",
    keyRisk:          "Credit event triggers disorderly deleveraging",
  },
  bear: {
    label:            "Hard Landing",
    trigger:          "If credit spreads blow out and unemployment rises materially",
    macroImplication: "Earnings contraction → liquidity drain → defensive rotation",
    keyRisk:          "Policy response too slow; CB credibility damaged by pivot delay",
  },
  alternative: {
    label:            "Stagflation Trap",
    trigger:          "If inflation resurges while growth disappoints simultaneously",
    macroImplication: "CB boxed in; real returns negative; commodity/cash preferred",
    keyRisk:          "Supply shock reversal or demand collapse breaks the stagflation dynamic",
  },
};

const RISK_OFF_TEMPLATE: ScenarioTemplate = {
  bull: {
    label:            "Capitulation Recovery",
    trigger:          "If VIX compresses and CB provides explicit liquidity backstop",
    macroImplication: "Risk-on reversal; vol sellers return; credit spreads tighten rapidly",
    keyRisk:          "Backstop perceived as premature — inflation re-acceleration",
  },
  base: {
    label:            "Grinding Stabilisation",
    trigger:          "If stress metrics plateau without systemic event escalation",
    macroImplication: "Gradual vol compression; selective recovery; no broad re-rating",
    keyRisk:          "Credit contagion from a single large credit event",
  },
  bear: {
    label:            "Systemic Stress Extension",
    trigger:          "If HY spreads breach 600bps or funding markets seize",
    macroImplication: "Forced deleveraging cascade; liquidity spiral; EM/Gulf outflows",
    keyRisk:          "Coordinated CB response insufficient to arrest spread widening",
  },
};

function selectTemplate(primaryRegime: string, isSaudi: boolean): ScenarioTemplate {
  if (isSaudi) return SAUDI_TEMPLATE;
  if (/high_vol_risk_off/.test(primaryRegime)) return RISK_OFF_TEMPLATE;
  return GLOBAL_TEMPLATE;
}

// ─── Probability derivation ───────────────────────────────────────────────────

function parsePrimaryRegime(regime: string): PrimaryRegimeKey {
  const l = (regime ?? "").toLowerCase().replace(/[-\s]/g, "_");
  if (/bull.*trend|risk_on/.test(l))      return "bull_trending";
  if (/low_vol|accumulation/.test(l))     return "low_vol_accumulation";
  if (/high_vol|risk_off/.test(l))        return "high_vol_risk_off";
  if (/bear.*rang|contraction/.test(l))   return "bear_ranging";
  return "macro_transition";
}

function deriveProbabilities(
  primaryRegime: string,
  macroBias: "bullish" | "bearish" | "neutral",
  creditStressLevel: "low" | "moderate" | "high" | "extreme",
  oilPrice: number | null | undefined,
  isSaudi: boolean,
): ProbTable {
  const key = parsePrimaryRegime(primaryRegime);
  const tier: BiasTier = macroBias === "bullish" ? "bullish" : macroBias === "bearish" ? "bearish" : "neutral";
  const base = { ...PROB_TABLE[key][tier] };

  // Credit stress adjustment
  if (creditStressLevel === "high")    { base.bull -= 6;  base.bear += 6; }
  if (creditStressLevel === "extreme") { base.bull -= 12; base.bear += 12; }

  // Saudi oil-price adjustment
  if (isSaudi && oilPrice != null) {
    if (oilPrice < 75) { base.bull -= 5; base.bear += 5; }
    if (oilPrice > 85) { base.bull += 5; base.bear -= 5; }
  }

  // Normalise to sum=100
  const sum = base.bull + base.base + base.bear;
  return {
    bull: Math.max(5,  Math.round((base.bull / sum) * 100)),
    base: Math.max(10, Math.round((base.base / sum) * 100)),
    bear: Math.max(5,  Math.round((base.bear / sum) * 100)),
  };
}

// ─── Competition intensity ────────────────────────────────────────────────────

function scoreIntensity(probs: ProbTable): "high" | "moderate" | "low" {
  const max = Math.max(probs.bull, probs.base, probs.bear);
  const min = Math.min(probs.bull, probs.base, probs.bear);
  const spread = max - min;
  if (max >= 60)     return "low";     // one scenario dominates
  if (spread <= 22)  return "high";    // three scenarios closely contested
  return "moderate";
}

// ─── Context builder ──────────────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function buildForesightContext(
  bull: CompetingScenario,
  base: CompetingScenario,
  bear: CompetingScenario,
  dominant: ScenarioBias,
): string {
  // Format: BASE(pct%) → brief | BULL(pct%) | BEAR(pct%) [dominant: X]
  const b  = trimTo(base.trigger, 55);
  const bu = trimTo(bull.trigger, 45);
  const br = trimTo(bear.trigger, 45);
  return `BASE(${base.probability}%) ${b} | BULL(${bull.probability}%) ${bu} | BEAR(${bear.probability}%) ${br} [dominant:${dominant}]`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildScenarioCompetition(input: {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  isSaudi:           boolean;
  oilPrice?:         number | null;
  isTransition?:     boolean;  // true when regime = macro_transition
}): ScenarioCompetitionProfile {
  const { regime, macroBias, creditStressLevel, isSaudi, oilPrice, isTransition } = input;

  const probs     = deriveProbabilities(regime, macroBias, creditStressLevel, oilPrice, isSaudi);
  const template  = selectTemplate(regime, isSaudi);
  const intensity = scoreIntensity(probs);

  const bull: CompetingScenario = { ...template.bull, probability: probs.bull };
  const base: CompetingScenario = { ...template.base, probability: probs.base };
  const bear: CompetingScenario = { ...template.bear, probability: probs.bear };

  // Alternative path: add when macro_transition OR extreme credit stress
  const includeAlternative = isTransition || creditStressLevel === "extreme";
  const alternative: CompetingScenario | undefined = (includeAlternative && template.alternative)
    ? { ...template.alternative, probability: Math.floor(bear.probability * 0.35) }
    : undefined;

  const maxProb = Math.max(probs.bull, probs.base, probs.bear);
  const dominantScenario: ScenarioBias =
    maxProb === probs.bull ? "bull" :
    maxProb === probs.bear ? "bear" : "base";

  const foresightContext = buildForesightContext(bull, base, bear, dominantScenario);
  const probabilitySum   = probs.bull + probs.base + probs.bear;

  return {
    bull,
    base,
    bear,
    alternative,
    dominantScenario,
    competitionIntensity: intensity,
    foresightContext: trimTo(foresightContext, 220),
    probabilitySum,
  };
}
