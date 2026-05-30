// Phase-89C: Regime History Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from all existing historical engines:
//   historicalLearning / historicalAnalogEngine: episode/era MATCHING
//   regimeHistoryEngine (89C): HISTORICAL REGIME NORMS — what are the typical
//                               duration, depth, asset behaviour, and resolution
//                               precedents for each REGIME TYPE the current
//                               market is in? Not "which episode matches" but
//                               "what do we know about how regimes like this
//                               typically unfold and end?"
//
// 5 regime history types:
//   inflation_era:     historically 18-48M; resolved by Volcker-type CB shock or supply
//   tightening_cycle:  historically 12-30M; resolved by data-dependent pause → pivot
//   easing_cycle:      historically 6-24M; risk assets reflate with 6-12M lag
//   oil_era:           negative 6-18M; positive creates inflation/tightening loop
//   credit_stress_era: acute 2-9M; recovery 12-24M; CB backstop is key trigger
//
// Cycle phase detection (early/mid/late/unknown):
//   early:   < 6 months from onset (fresh/new/just signals in text)
//   mid:     6-18 months established (for weeks/months signals)
//   late:    > 18 months entrenched (since X quarter/year/long-standing signals)
//
// Depth assessment (shallow/moderate/deep/extreme):
//   Derived from credit stress level + price move magnitude + signal persistence
//
// Output: RegimeHistoryProfile with injectable regimeHistCtx (≤180 chars).
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type RegimeHistoryType =
  | "inflation_era"
  | "tightening_cycle"
  | "easing_cycle"
  | "oil_era_negative"
  | "oil_era_positive"
  | "credit_stress_era";

export type CyclePhase   = "early" | "mid" | "late" | "unknown";
export type DepthLevel   = "shallow" | "moderate" | "deep" | "extreme";

export interface RegimeHistoryEntry {
  type:                RegimeHistoryType;
  name:                string;
  typicalDurationMonths: [number, number];
  assetNorms:          string;   // ≤65 chars: typical asset-class behavior
  resolutionPrecedent: string;   // ≤60 chars: how this regime type typically ends
  fiduciaryConsideration: string; // ≤60 chars: key allocator awareness
}

export interface RegimeHistoryProfile {
  activeRegimes:       RegimeHistoryEntry[];
  cyclePhase:          CyclePhase;
  depthLevel:          DepthLevel;
  historicalNorms:     string;   // ≤65 chars: from most relevant active regime
  regimeHistCtx:       string;   // ≤180 chars injectable
}

// ─── Regime history library ───────────────────────────────────────────────────

const REGIME_HISTORY: Record<RegimeHistoryType, RegimeHistoryEntry> = {
  inflation_era: {
    type:                   "inflation_era",
    name:                   "Inflation Era",
    typicalDurationMonths:   [18, 48],
    assetNorms:              "Long bonds worst; commodities/TIPS outperform; equities mixed",
    resolutionPrecedent:     "CB credibility restored via aggressive hiking (Volcker pattern)",
    fiduciaryConsideration:  "Reduce long duration; real assets and short-term quality",
  },
  tightening_cycle: {
    type:                   "tightening_cycle",
    name:                   "Tightening Cycle",
    typicalDurationMonths:   [12, 30],
    assetNorms:              "Early: equities sell initially; credit spreads widen late-cycle",
    resolutionPrecedent:     "Data-dependent pause → hold → pivot signal when growth slows",
    fiduciaryConsideration:  "Watch yield curve inversion; reduce HY near tightening peak",
  },
  easing_cycle: {
    type:                   "easing_cycle",
    name:                   "Easing Cycle",
    typicalDurationMonths:   [6, 24],
    assetNorms:              "Long bonds rally immediately; equities with 6-12M lag; EM benefits",
    resolutionPrecedent:     "CB stops cutting when growth re-established; risk-on re-rates",
    fiduciaryConsideration:  "Add duration; position for risk-on with time-lag awareness",
  },
  oil_era_negative: {
    type:                   "oil_era_negative",
    name:                   "Oil Decline Era",
    typicalDurationMonths:   [6, 18],
    assetNorms:              "Energy -30-50%; GCC fiscal stress; EM commodity exporters hurt",
    resolutionPrecedent:     "OPEC supply cuts / demand recovery stabilises price",
    fiduciaryConsideration:  "Saudi fiscal breakeven ~$75-80/bbl; avoid GCC cyclicals",
  },
  oil_era_positive: {
    type:                   "oil_era_positive",
    name:                   "Oil Surge Era",
    typicalDurationMonths:   [6, 18],
    assetNorms:              "Energy+; inflation surge; CB tightening follows; importers pressured",
    resolutionPrecedent:     "Demand destruction + CB tightening eventually caps price",
    fiduciaryConsideration:  "Inflation protection; energy; reduce rate-sensitive long-duration",
  },
  credit_stress_era: {
    type:                   "credit_stress_era",
    name:                   "Credit Stress Era",
    typicalDurationMonths:   [2, 9],
    assetNorms:              "Flight to quality; DM sovereigns bid; HY +400-800bps; equities -30-50%",
    resolutionPrecedent:     "CB emergency backstop + fiscal support + forced deleveraging completion",
    fiduciaryConsideration:  "Cash first; deploy systematically when CB backstop signal appears",
  },
};

// ─── Active regime detection ──────────────────────────────────────────────────

// Use prefix matching (start boundary only) so "tightening" matches \btighten,
// "hawkish" matches \bhawk, "easing" matches \beas, etc.
const INFLATION_SIGNAL  = /\b(inflat.*(above.target|elev|high|persist|sticky)|cpi.above|above.4%|wage.inflat)\b/i;
const TIGHTENING_SIGNAL = /\btighten|\bhawkish|\bhiking|\bhike\b|\brestrict|\braising.rate|\brate.rise|\bqt\b|\baggressive.hike/i;
const EASING_SIGNAL     = /\beasing|\brate.cut|\bdovish|\bpivot\b|\baccommo|\bqe\b|\bstimulus/i;
// Use .*crash to handle "oil has crashed" (multiple words between oil and crash)
const OIL_NEG_SIGNAL    = /\boil.*(fall|crash|below|down|collapse|plunge)|\bbrent.*(below|fall|crash)|\bcrude.*(fall|crash)/i;
const OIL_POS_SIGNAL    = /\boil.*(surge|spike|rally|above.80)|\bbrent.above|\bcrude.surge|\boil.rally/i;
const CREDIT_SIGNAL     = /\b(credit.stress|spread.wid|hy.blow|credit.crunch|funding.freeze|bank.stress)\b/i;

function detectActiveRegimes(input: {
  ratesEnv:    string;
  oilChangePct?: number | null;
  oilPrice?:     number | null;
  creditStress:  "low" | "moderate" | "high" | "extreme";
  question:      string;
  ctx:           string;
}): RegimeHistoryEntry[] {
  const { ratesEnv, oilChangePct, oilPrice, creditStress, question, ctx } = input;
  const text = `${ratesEnv} ${question} ${ctx}`.toLowerCase();
  const active: RegimeHistoryEntry[] = [];

  if (INFLATION_SIGNAL.test(text))                                     active.push(REGIME_HISTORY.inflation_era);
  if (TIGHTENING_SIGNAL.test(text) && !EASING_SIGNAL.test(text))       active.push(REGIME_HISTORY.tightening_cycle);
  else if (EASING_SIGNAL.test(text))                                    active.push(REGIME_HISTORY.easing_cycle);

  if (oilChangePct != null && oilChangePct < -3)                       active.push(REGIME_HISTORY.oil_era_negative);
  else if (oilPrice != null && oilPrice < 65)                          active.push(REGIME_HISTORY.oil_era_negative);
  else if (oilChangePct != null && oilChangePct > 3)                   active.push(REGIME_HISTORY.oil_era_positive);
  else if (OIL_NEG_SIGNAL.test(text))                                  active.push(REGIME_HISTORY.oil_era_negative);
  else if (OIL_POS_SIGNAL.test(text))                                  active.push(REGIME_HISTORY.oil_era_positive);

  if (creditStress === "high" || creditStress === "extreme")            active.push(REGIME_HISTORY.credit_stress_era);
  else if (CREDIT_SIGNAL.test(text))                                    active.push(REGIME_HISTORY.credit_stress_era);

  // Deduplicate
  return active.filter((v, i, a) => a.findIndex(x => x.type === v.type) === i);
}

// ─── Cycle phase detection ────────────────────────────────────────────────────

const ENTRENCHED_CUES = /\b(for months|all year|throughout.Q|since.Q|long.standing|persistent|entrenched|deep.seated)\b/i;
const ESTABLISHED_CUES = /\b(for.weeks|past.few.weeks|over.the.past.month|in.recent.weeks)\b/i;
const FRESH_CUES = /\b(just|this.week|recently.(shifted|started|began)|new.regime|sudden)\b/i;

function detectCyclePhase(text: string): CyclePhase {
  if (ENTRENCHED_CUES.test(text)) return "late";
  if (ESTABLISHED_CUES.test(text)) return "mid";
  if (FRESH_CUES.test(text)) return "early";
  return "unknown";
}

// ─── Depth assessment ────────────────────────────────────────────────────────

function assessDepth(
  creditStress: "low" | "moderate" | "high" | "extreme",
  oilChangePct?: number | null,
  tltChangePct?: number | null,
): DepthLevel {
  if (creditStress === "extreme") return "extreme";
  if (creditStress === "high")    return "deep";
  if ((oilChangePct != null && Math.abs(oilChangePct) >= 8) || (tltChangePct != null && Math.abs(tltChangePct) >= 2.5)) return "deep";
  if (creditStress === "moderate") return "moderate";
  return "shallow";
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildRegimeHistCtx(
  active:       RegimeHistoryEntry[],
  phase:        CyclePhase,
  depth:        DepthLevel,
): string {
  if (active.length === 0) return "No active regime history pattern matched.";
  const primary = active[0];
  const dur     = `${primary.typicalDurationMonths[0]}-${primary.typicalDurationMonths[1]}M typically`;
  const phaseStr = phase !== "unknown" ? ` phase=${phase}` : "";
  return `Regime history[${primary.type}|${depth}${phaseStr}]: ${dur} | ${primary.assetNorms.slice(0,55)} | ${primary.resolutionPrecedent.slice(0,50)}`.slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildRegimeHistoryProfile(input: {
  question:          string;
  ctx:               string;
  ratesEnv:          string;
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  oilChangePct?:     number | null;
  oilPrice?:         number | null;
  tltChangePct?:     number | null;
}): RegimeHistoryProfile {
  const { question, ctx, ratesEnv, creditStressLevel, oilChangePct, oilPrice, tltChangePct } = input;

  const activeRegimes = detectActiveRegimes({ ratesEnv, oilChangePct, oilPrice, creditStress: creditStressLevel, question, ctx });
  const text          = `${question} ${ctx}`;
  const cyclePhase    = detectCyclePhase(text);
  const depthLevel    = assessDepth(creditStressLevel, oilChangePct, tltChangePct);

  const historicalNorms = activeRegimes.length > 0
    ? activeRegimes[0].assetNorms.slice(0, 65)
    : "No dominant regime pattern; monitor for clearer signal";

  return {
    activeRegimes,
    cyclePhase,
    depthLevel,
    historicalNorms,
    regimeHistCtx: buildRegimeHistCtx(activeRegimes, cyclePhase, depthLevel),
  };
}
