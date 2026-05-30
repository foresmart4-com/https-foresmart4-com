// Phase-89C: Crisis History Library
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from historicalLearning.ts (Phase-74) and historicalAnalogEngine.ts (Phase-83A):
//   historicalLearning: keyword → specific EPISODE match (Great Depression, 1970s stagflation, etc.)
//   historicalAnalogEngine: multi-episode comparison with false-analog risk scores
//   crisisHistoryLibrary (89C): CRISIS ARCHETYPES — generic reusable PATTERN templates
//                               that describe HOW crises of each type typically unfold,
//                               regardless of specific dates. Pattern-level, not episode-level.
//
// 6 crisis archetypes:
//   inflation_crisis:    supply/demand imbalance → CB credibility erosion → wage-price spiral
//   banking_stress:      credit event → bank funding squeeze → credit contraction
//   sovereign_pressure:  fiscal deficit → sovereign spread widening → austerity feedback
//   liquidity_shock:     funding market seizure → margin calls → correlated forced selling
//   oil_shock:           oil price extreme → fiscal/inflation channel → CB response
//   recession:           demand contraction → earnings decline → unemployment → wealth effect
//
// Detection: scored signal matching across live data + text signals.
// Multiple archetypes may be simultaneously active (e.g., inflation_crisis + oil_shock).
//
// Output: CrisisMemoryResult with injectable crisisCtx (≤200 chars).
// No execution language. Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type CrisisArchetypeId =
  | "inflation_crisis"
  | "banking_stress"
  | "sovereign_pressure"
  | "liquidity_shock"
  | "oil_shock"
  | "recession";

export interface CrisisArchetype {
  id:                   CrisisArchetypeId;
  name:                 string;
  transmissionPattern:  string;  // ≤70 chars: A → B → C chain
  typicalDurationMonths: [number, number];  // [min, max]
  assetBehaviorSummary: string;  // ≤65 chars
  resolutionMechanism:  string;  // ≤60 chars
  fiduciaryNote:        string;  // ≤60 chars: allocator action framing
  falseTriggerWarning:  string;  // ≤60 chars: what superficially resembles this but isn't
}

export interface DetectedCrisis {
  archetype: CrisisArchetype;
  signalScore: number;  // 0-20 (higher = stronger pattern match)
}

export interface CrisisMemoryResult {
  detectedCrises:   DetectedCrisis[];
  dominantCrisis:   DetectedCrisis | null;
  crisisCtx:        string;  // ≤200 chars injectable
  isActiveCrisis:   boolean; // true when at least one archetype scores ≥5
}

// ─── Archetype library ────────────────────────────────────────────────────────

const CRISIS_ARCHETYPES: CrisisArchetype[] = [
  {
    id:                   "inflation_crisis",
    name:                 "Inflation Crisis",
    transmissionPattern:  "Supply shock / demand excess → CB credibility erosion → wage-price spiral → Volcker-type shock",
    typicalDurationMonths: [18, 48],
    assetBehaviorSummary: "Equities -30-50%; long bonds worst; commodities surge; gold late-cycle winner",
    resolutionMechanism:  "CB credibility restoration or supply normalization",
    fiduciaryNote:        "Avoid long duration; consider real assets and TIPS",
    falseTriggerWarning:  "Transitory CPI spike without wage acceleration is NOT inflation crisis",
  },
  {
    id:                   "banking_stress",
    name:                 "Banking Stress",
    transmissionPattern:  "Credit event → bank funding pressure → lending contraction → economic slowdown",
    typicalDurationMonths: [12, 36],
    assetBehaviorSummary: "Banks -40-70%; HY spreads +300-600bps; flight to quality DM sovereigns",
    resolutionMechanism:  "CB backstop + government recapitalization (QE/TARP pattern)",
    fiduciaryNote:        "Prioritise liquidity; avoid bank/HY; hold cash or DM sovereigns",
    falseTriggerWarning:  "Spread widening without deposit outflow/funding stress ≠ banking crisis",
  },
  {
    id:                   "sovereign_pressure",
    name:                 "Sovereign Pressure",
    transmissionPattern:  "Fiscal deficit → sovereign spread widening → austerity → demand destruction → recession",
    typicalDurationMonths: [18, 48],
    assetBehaviorSummary: "Local bonds crushed; equities -40%; currency devaluation risk",
    resolutionMechanism:  "IMF program / CB backstop (ECB OMT pattern) / fiscal adjustment",
    fiduciaryNote:        "Watch CDS spreads; avoid local assets during IMF negotiations",
    falseTriggerWarning:  "High debt without spread widening or rating action ≠ sovereign stress",
  },
  {
    id:                   "liquidity_shock",
    name:                 "Liquidity Shock",
    transmissionPattern:  "Funding market seizure → margin calls → forced selling → correlated cross-asset liquidation",
    typicalDurationMonths: [2, 6],
    assetBehaviorSummary: "All assets fall together (correlation→1); DM sovereigns only safe haven",
    resolutionMechanism:  "CB emergency liquidity injection (2008 TARP, 2020 QE pattern)",
    fiduciaryNote:        "Cash first; deploy systematically on CB backstop signal",
    falseTriggerWarning:  "Equity sell-off without funding market stress ≠ liquidity shock",
  },
  {
    id:                   "oil_shock",
    name:                 "Oil Shock",
    transmissionPattern:  "Oil price extreme → fiscal/inflation channel → CB response → EM/GCC secondary effects",
    typicalDurationMonths: [6, 18],
    assetBehaviorSummary: "Negative: energy -30-50%; GCC fiscal stress. Positive: inflation surge; CB tightening",
    resolutionMechanism:  "OPEC supply decision / demand recovery / geopolitical resolution",
    fiduciaryNote:        "Monitor Saudi fiscal breakeven; avoid GCC cyclicals on negative shock",
    falseTriggerWarning:  "Single-session oil volatility without sustained trend ≠ oil shock archetype",
  },
  {
    id:                   "recession",
    name:                 "Recession",
    transmissionPattern:  "Demand contraction → earnings decline → layoffs → credit stress → wealth effect destruction",
    typicalDurationMonths: [8, 18],
    assetBehaviorSummary: "Equities -30-50%; defensives outperform; HY +400-800bps",
    resolutionMechanism:  "Fiscal/monetary stimulus → inventory rebuild → consumption recovery",
    fiduciaryNote:        "Rotate to defensives/quality; reduce cyclical exposure",
    falseTriggerWarning:  "Single negative GDP quarter without credit deterioration ≠ recession archetype",
  },
];

// ─── Signal scoring ───────────────────────────────────────────────────────────

const INFLATION_SIGNAL = /\b(inflation.above|inflation.high|cpi.above|cpi.high|wage.inflat|price.spiral|above.target|above.4%|stagflat)\b/i;
const BANKING_SIGNAL   = /\b(bank.stress|bank.fail|credit.crunch|funding.freeze|deposit.outflow|spread.blow|hy.stress|bank.run)\b/i;
const SOVEREIGN_SIGNAL = /\b(sovereign.risk|sovereign.spread|fiscal.deficit|imf.program|credit.downgrade|rating.cut|government.default|debt.crisis)\b/i;
const LIQUIDITY_SIGNAL = /\b(margin.call|forced.sell|liquidation|funding.seize|repo.stress|correlat.*fall|flash.crash)\b/i;
// Note: use \w* suffix or .* between words to catch inflected forms (crashed, collapsing)
const OIL_SHOCK_SIGNAL = /\b(oil.shock|oil.collaps\w*|oil.crash\w*|oil.fell|oil.spike|oil.surge|oil.plunge|brent.crash\w*|brent.fell|wti.crash\w*|opec.cut|oil.sanction|crude.crash\w*)\b|oil\s+has\s+crash/i;
const RECESSION_SIGNAL = /\b(recession|gdp.contract|gdp.decline|gdp.negative|earnings.decline|unemployment.rise|consumer.contraction|demand.collapse)\b/i;

function scoreArchetype(
  id: CrisisArchetypeId,
  text: string,
  creditStress: "low" | "moderate" | "high" | "extreme",
  oilChangePct: number | null | undefined,
  oilPrice:     number | null | undefined,
  macroBias:    "bullish" | "bearish" | "neutral",
  tltChangePct: number | null | undefined,
  spyChangePct: number | null | undefined,
): number {
  let score = 0;
  switch (id) {
    case "inflation_crisis":
      if (INFLATION_SIGNAL.test(text))                                           score += 4;
      if (/hawkish|restrict|above.neutral/.test(text.toLowerCase()))             score += 2;
      if (tltChangePct != null && tltChangePct < -1.5)                           score += 3;
      if (oilChangePct != null && oilChangePct > 5)                              score += 2;
      break;
    case "banking_stress":
      if (creditStress === "extreme")                                             score += 6;
      else if (creditStress === "high")                                           score += 3;
      if (BANKING_SIGNAL.test(text))                                              score += 4;
      if (spyChangePct != null && spyChangePct < -3)                             score += 2;
      break;
    case "sovereign_pressure":
      if (SOVEREIGN_SIGNAL.test(text))                                            score += 6;
      if (creditStress === "high" || creditStress === "extreme")                  score += 2;
      if (/austerity|imf|fiscal.tighten/.test(text.toLowerCase()))               score += 2;
      break;
    case "liquidity_shock":
      if (creditStress === "extreme")                                              score += 5;
      if (LIQUIDITY_SIGNAL.test(text))                                             score += 4;
      if (tltChangePct != null && tltChangePct < -1.5 && spyChangePct != null && spyChangePct < -2) score += 3;
      break;
    case "oil_shock":
      if (oilChangePct != null && Math.abs(oilChangePct) >= 5)                   score += 5;
      else if (oilChangePct != null && Math.abs(oilChangePct) >= 3)              score += 3;
      if (OIL_SHOCK_SIGNAL.test(text))                                            score += 4;
      if (oilPrice != null && oilPrice < 60)                                      score += 2;
      break;
    case "recession":
      if (macroBias === "bearish")                                                score += 2;
      if (RECESSION_SIGNAL.test(text))                                            score += 5;
      if (creditStress === "high" || creditStress === "extreme")                  score += 2;
      if (/earnings.miss|forward.guidance.cut|capex.cut/.test(text.toLowerCase())) score += 2;
      break;
  }
  return score;
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildCrisisCtx(dominant: DetectedCrisis | null, count: number): string {
  if (!dominant) return "No dominant crisis archetype detected in current context.";
  const a = dominant.archetype;
  return `Crisis[${a.id}|score:${dominant.signalScore}]: ${a.transmissionPattern.slice(0,60)} | ${a.assetBehaviorSummary.slice(0,55)} | ${count > 1 ? `+${count-1} other` : ""}`.slice(0, 200);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectCrisisArchetypes(input: {
  question:          string;
  ctx:               string;
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  oilChangePct?:     number | null;
  oilPrice?:         number | null;
  macroBias:         "bullish" | "bearish" | "neutral";
  tltChangePct?:     number | null;
  spyChangePct?:     number | null;
}): CrisisMemoryResult {
  const { question, ctx, creditStressLevel, oilChangePct, oilPrice, macroBias, tltChangePct, spyChangePct } = input;
  const text = `${question} ${ctx}`.slice(0, 2000);
  const THRESHOLD = 4;

  const detected: DetectedCrisis[] = CRISIS_ARCHETYPES
    .map(a => ({
      archetype: a,
      signalScore: scoreArchetype(a.id, text, creditStressLevel, oilChangePct, oilPrice, macroBias, tltChangePct, spyChangePct),
    }))
    .filter(d => d.signalScore >= THRESHOLD)
    .sort((a, b) => b.signalScore - a.signalScore);

  const dominant = detected[0] ?? null;

  return {
    detectedCrises: detected,
    dominantCrisis: dominant,
    crisisCtx:      buildCrisisCtx(dominant, detected.length),
    isActiveCrisis: detected.length > 0,
  };
}
