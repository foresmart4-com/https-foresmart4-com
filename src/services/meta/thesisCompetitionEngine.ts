// Phase-88C: Thesis Competition Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from debateEngine.ts (Phase-32):
//   debateEngine: POSITION-based (bull_case/bear_case/macro_objection) with
//                 contextString ≤160 chars; confidence_impact; narrative
//   thesisCompetitionEngine: STRUCTURED THESIS objects with evidence weights,
//                             key assumptions, and weak points; competes bull/
//                             bear/base as institutional research hypotheses
//
// Problem: Genesis collapses toward a dominant view without formally structuring
// the competing investment THESES and their evidence weights. Institutional
// research centers maintain parallel hypotheses — each with explicit assumptions,
// evidence basis, and known weak points — before resolving.
//
// Evidence weight (0-100): how well current signals support each thesis.
// NOT probability (foresight engine handles that). Weight = evidence alignment.
//
// contestLevel: "lopsided" when one thesis has >40pt weight advantage,
//               "heavily_contested" when spread <20pts.
//
// No execution language. Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type ThesisStance = "bull" | "bear" | "base";

export interface CompetingThesis {
  stance:         ThesisStance;
  coreAssertion:  string;  // ≤62 chars: central investment claim
  evidenceBasis:  string;  // ≤62 chars: supporting signal(s)
  keyAssumption:  string;  // ≤55 chars: what must hold for thesis to survive
  weakPoint:      string;  // ≤55 chars: specific vulnerability
  weight:         number;  // 0-100 evidence weight
}

export interface ThesisCompetitionProfile {
  bull:           CompetingThesis;
  bear:           CompetingThesis;
  base:           CompetingThesis;
  dominant:       ThesisStance;
  weightSpread:   number;  // max − min weight
  contestLevel:   "heavily_contested" | "moderately_contested" | "lopsided";
  competitionCtx: string;  // ≤200 chars injectable
}

// ─── Evidence weight table ────────────────────────────────────────────────────

type PrimaryRegimeKey =
  | "bull_trending" | "bear_ranging" | "high_vol_risk_off"
  | "low_vol_accumulation" | "macro_transition";

type BiasTier = "bullish" | "neutral" | "bearish";

interface WeightSet { bull: number; base: number; bear: number; }

const WEIGHT_TABLE: Record<PrimaryRegimeKey, Record<BiasTier, WeightSet>> = {
  bull_trending: {
    bullish: { bull: 68, base: 52, bear: 28 },
    neutral: { bull: 55, base: 58, bear: 38 },
    bearish: { bull: 38, base: 55, bear: 52 },
  },
  low_vol_accumulation: {
    bullish: { bull: 62, base: 58, bear: 30 },
    neutral: { bull: 52, base: 62, bear: 40 },
    bearish: { bull: 35, base: 58, bear: 52 },
  },
  macro_transition: {
    bullish: { bull: 50, base: 55, bear: 45 },
    neutral: { bull: 45, base: 58, bear: 48 },
    bearish: { bull: 35, base: 52, bear: 60 },
  },
  bear_ranging: {
    bullish: { bull: 40, base: 55, bear: 50 },
    neutral: { bull: 30, base: 55, bear: 60 },
    bearish: { bull: 22, base: 48, bear: 72 },
  },
  high_vol_risk_off: {
    bullish: { bull: 32, base: 50, bear: 55 },
    neutral: { bull: 22, base: 48, bear: 68 },
    bearish: { bull: 15, base: 40, bear: 78 },
  },
};

// ─── Thesis templates ─────────────────────────────────────────────────────────

interface ThesisTemplateSet {
  bull: Omit<CompetingThesis, "weight">;
  base: Omit<CompetingThesis, "weight">;
  bear: Omit<CompetingThesis, "weight">;
}

const SAUDI_TEMPLATES: ThesisTemplateSet = {
  bull: {
    stance:        "bull",
    coreAssertion: "Oil surplus + SAMA easing → TASI re-rating",
    evidenceBasis: "Brent above breakeven; Vision 2030 capex intact; credit growth",
    keyAssumption: "Oil holds above $78 and PIF deployment sustains",
    weakPoint:     "SAMA constrained by SAR peg if Fed holds",
  },
  base: {
    stance:        "base",
    coreAssertion: "Managed stability with selective sector divergence",
    evidenceBasis: "Oil oscillating near breakeven; project pipeline ongoing",
    keyAssumption: "Government spending pace maintained above 85% of budget",
    weakPoint:     "Single-commodity fiscal dependency limits diversification thesis",
  },
  bear: {
    stance:        "bear",
    coreAssertion: "Fiscal contraction → bank credit squeeze → TASI pressure",
    evidenceBasis: "Oil below $70 sustained; government spending reviews signalled",
    keyAssumption: "Oil stays below breakeven for 2+ consecutive quarters",
    weakPoint:     "PIF / sovereign buffers may delay but not prevent earnings impact",
  },
};

const GLOBAL_TEMPLATES: ThesisTemplateSet = {
  bull: {
    stance:        "bull",
    coreAssertion: "CB pivot + soft landing → multiple expansion + credit bid",
    evidenceBasis: "Inflation normalising; labour market cooling; curve un-inverting",
    keyAssumption: "No second inflation wave; recession avoided; CB cuts ≥50bps",
    weakPoint:     "Timing risk: markets may have pre-priced the pivot",
  },
  base: {
    stance:        "base",
    coreAssertion: "Higher-for-longer with gradual credit tightening",
    evidenceBasis: "Sticky services inflation; resilient employment; CB on hold",
    keyAssumption: "No large credit event; earnings hold above recession levels",
    weakPoint:     "Duration of restrictive policy undermines corporate refinancing",
  },
  bear: {
    stance:        "bear",
    coreAssertion: "Credit event triggers disorderly deleveraging cascade",
    evidenceBasis: "HY spreads widening; refinancing wall approaching; lending standards tightening",
    keyAssumption: "CB response is delayed or insufficient to arrest spread widening",
    weakPoint:     "CB has policy space to inject liquidity before systemic stress",
  },
};

const RISK_OFF_TEMPLATES: ThesisTemplateSet = {
  bull: {
    stance:        "bull",
    coreAssertion: "Vol spike is transitory; mean-reversion recovery is near",
    evidenceBasis: "Technicals oversold; VIX elevated beyond realised vol",
    keyAssumption: "No fundamental credit event underpins the vol spike",
    weakPoint:     "VIX persistence historically higher than expected after large spikes",
  },
  base: {
    stance:        "base",
    coreAssertion: "Grinding vol compression with selective recovery",
    evidenceBasis: "Stress metrics plateauing; no systemic escalation visible yet",
    keyAssumption: "Stress is idiosyncratic and does not transmit to credit broadly",
    weakPoint:     "Idiosyncratic stress has historically converted to systemic at 60% frequency",
  },
  bear: {
    stance:        "bear",
    coreAssertion: "Stress escalates to systemic event; forced deleveraging ahead",
    evidenceBasis: "Funding market strain; HY sell-off; EM/Gulf outflows accelerating",
    keyAssumption: "CB is behind the curve and cannot stabilise before contagion",
    weakPoint:     "CB put has repeatedly arrested bear theses at elevated vol levels",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrimaryRegime(regime: string): PrimaryRegimeKey {
  const l = (regime ?? "").toLowerCase().replace(/[-\s]/g, "_");
  if (/bull.*trend|risk_on/.test(l))      return "bull_trending";
  if (/low_vol|accumulation/.test(l))     return "low_vol_accumulation";
  if (/high_vol|risk_off/.test(l))        return "high_vol_risk_off";
  if (/bear.*rang|contraction/.test(l))   return "bear_ranging";
  return "macro_transition";
}

function adjustWeights(
  w: WeightSet,
  creditStress: "low" | "moderate" | "high" | "extreme",
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted",
  oilPrice: number | null | undefined,
  isSaudi: boolean,
): WeightSet {
  let { bull, base, bear } = w;
  if (creditStress === "high")    { bull -= 8;  bear += 8; }
  if (creditStress === "extreme") { bull -= 15; bear += 15; }
  if (consensusStrength === "conflicted") {
    // Compress toward equal weights
    const avg = (bull + base + bear) / 3;
    bull = Math.round(bull * 0.6 + avg * 0.4);
    base = Math.round(base * 0.6 + avg * 0.4);
    bear = Math.round(bear * 0.6 + avg * 0.4);
  }
  if (isSaudi && oilPrice != null) {
    if (oilPrice < 72)  { bull -= 8; bear += 8; }
    if (oilPrice > 85)  { bull += 8; bear -= 8; }
  }
  return {
    bull: Math.max(10, Math.min(90, bull)),
    base: Math.max(15, Math.min(85, base)),
    bear: Math.max(10, Math.min(90, bear)),
  };
}

function classifyContest(spread: number): ThesisCompetitionProfile["contestLevel"] {
  if (spread < 20) return "heavily_contested";
  if (spread < 42) return "moderately_contested";
  return "lopsided";
}

function buildCompetitionCtx(
  bull: CompetingThesis, base: CompetingThesis, bear: CompetingThesis,
  dominant: ThesisStance, contestLevel: ThesisCompetitionProfile["contestLevel"],
): string {
  const dom  = dominant === "bull" ? bull : dominant === "bear" ? bear : base;
  const opp  = dominant === "bull" ? bear : dominant === "bear" ? bull : base;
  const mid  = dominant === "base" ? bull : base;
  return `DOMINANT[${dominant}](w=${dom.weight}): ${dom.coreAssertion.slice(0,50)} | COUNTER[${opp.stance}](w=${opp.weight}): ${opp.coreAssertion.slice(0,45)} | MID[${mid.stance}](w=${mid.weight}) [${contestLevel}]`.slice(0,200);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildThesisCompetition(input: {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  isSaudi:           boolean;
  oilPrice?:         number | null;
}): ThesisCompetitionProfile {
  const { regime, macroBias, creditStressLevel, consensusStrength, isSaudi, oilPrice } = input;

  const key   = parsePrimaryRegime(regime);
  const tier: BiasTier = macroBias === "bullish" ? "bullish" : macroBias === "bearish" ? "bearish" : "neutral";
  const raw   = WEIGHT_TABLE[key][tier];
  const w     = adjustWeights(raw, creditStressLevel, consensusStrength, oilPrice, isSaudi);

  const tmpl  = isSaudi ? SAUDI_TEMPLATES
    : /high_vol_risk_off/.test(key) ? RISK_OFF_TEMPLATES
    : GLOBAL_TEMPLATES;

  const bull: CompetingThesis = { ...tmpl.bull, weight: w.bull };
  const base: CompetingThesis = { ...tmpl.base, weight: w.base };
  const bear: CompetingThesis = { ...tmpl.bear, weight: w.bear };

  const maxW  = Math.max(w.bull, w.base, w.bear);
  const minW  = Math.min(w.bull, w.base, w.bear);
  const dominant: ThesisStance =
    maxW === w.bull ? "bull" : maxW === w.bear ? "bear" : "base";
  const spread      = maxW - minW;
  const contestLevel = classifyContest(spread);

  return {
    bull, base, bear, dominant,
    weightSpread:   spread,
    contestLevel,
    competitionCtx: buildCompetitionCtx(bull, base, bear, dominant, contestLevel),
  };
}
