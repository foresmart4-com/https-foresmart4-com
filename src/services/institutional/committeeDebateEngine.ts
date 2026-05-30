// LCCR-2: Committee Debate Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Root cause addressed: Genesis produces single-thesis dominance instead of
// genuine institutional committee debate. Investment committees ALWAYS surface
// the strongest objection to the dominant view before making a decision.
//
// Distinct from existing modules:
//   committeeDebate.ts (Phase-65)  — CommitteeStance label + company selection framework
//   committeeEngine.ts (Phase-82A) — AI voice directive (macro/policy/allocator/behavioral)
//   committeeDynamicsEngine.ts (88A) — committee dynamics (tension, minority argument)
//   thesisCompetitionEngine.ts (88C) — thesis competition (dominant/contested/bear)
//
// This module structures the INVESTMENT DEBATE itself:
//   — Bull case: strongest 2-3 reasons FOR the position
//   — Bear case: strongest 2-3 reasons AGAINST
//   — Strongest objection to the bull
//   — Evidence weighting (which side has more grounding)
//   — Probability competition (bull% vs bear% vs neutral%)
//   — Debate outcome: which view wins and WHY
//
// Educational/advisory only. No execution language. No broker data.

import type { Lang } from "@/lib/ai/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DebateVerdict =
  | "bull_prevails"           // bull thesis wins; risks are manageable and priced
  | "bear_prevails"           // bear thesis wins; risks outweigh opportunity
  | "conditional_bull"        // bull conditional on a named catalyst or signal
  | "conditional_bear"        // bear conditional; deterioration not yet confirmed
  | "stalemate";              // evidence too balanced; committee cannot resolve

export type EvidenceWeighting =
  | "strongly_bull"  // clear majority of evidence supports the bull case
  | "modestly_bull"  // more evidence on bull side; but meaningful bear signals
  | "balanced"       // evidence roughly split; each side has strong points
  | "modestly_bear"  // more evidence on bear side; some bull conditions remain
  | "strongly_bear"; // clear majority of evidence supports the bear case

export interface CommitteeDebateResult {
  bullCase:           string;           // 1-2 sentences: strongest case FOR
  bearCase:           string;           // 1-2 sentences: strongest case AGAINST
  strongestObjection: string;           // 1 sentence: the hardest challenge to the bull
  evidenceWeighting:  EvidenceWeighting;
  bullProbability:    number;           // 0-100
  bearProbability:    number;           // 0-100
  verdict:            DebateVerdict;
  verdictRationale:   string;           // 1 sentence: why this verdict
  debateContext:      string;           // injectable ≤380 chars
}

interface DebateInput {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStress:      "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  consensusScore:    number;       // 0-100
  regimeConf:        number;       // 0-100
  uncertaintyLevel:  "low" | "moderate" | "high" | "extreme";
  isSaudi:           boolean;
  oilPrice:          number | null;
  question:          string;
  lang:              Lang;
}

// ─── Evidence weighting ───────────────────────────────────────────────────────

function deriveEvidenceWeighting(i: DebateInput): EvidenceWeighting {
  let bullScore = 0;
  let bearScore = 0;

  if (i.macroBias === "bullish") bullScore += 3;
  else if (i.macroBias === "bearish") bearScore += 3;

  if (i.creditStress === "low") bullScore += 2;
  else if (i.creditStress === "moderate") { bullScore += 1; bearScore += 1; }
  else if (i.creditStress === "high") bearScore += 2;
  else if (i.creditStress === "extreme") bearScore += 4;

  if (i.consensusStrength === "strong" && i.macroBias !== "bearish") bullScore += 2;
  else if (i.consensusStrength === "conflicted") { bearScore += 1; }
  else if (i.consensusStrength === "weak") bearScore += 1;

  if (i.regimeConf > 70) bullScore += (i.macroBias === "bullish" ? 1 : 0);
  else if (i.regimeConf < 40) { bearScore += 1; }

  if (i.isSaudi && i.oilPrice !== null) {
    if (i.oilPrice >= 80) bullScore += 2;
    else if (i.oilPrice >= 70) bullScore += 1;
    else if (i.oilPrice < 65) bearScore += 2;
  }

  const gap = bullScore - bearScore;
  if (gap >= 5) return "strongly_bull";
  if (gap >= 2) return "modestly_bull";
  if (gap <= -5) return "strongly_bear";
  if (gap <= -2) return "modestly_bear";
  return "balanced";
}

// ─── Probability competition ─────────────────────────────────────────────────

function deriveProbabilities(weighting: EvidenceWeighting, regimeConf: number): { bull: number; bear: number } {
  const confAdj = Math.round((regimeConf - 50) / 10);  // -5 to +5
  let bull: number;
  let bear: number;
  switch (weighting) {
    case "strongly_bull":  bull = 65 + confAdj; bear = 20; break;
    case "modestly_bull":  bull = 55 + confAdj; bear = 28; break;
    case "balanced":       bull = 45;           bear = 35; break;
    case "modestly_bear":  bull = 32;           bear = 50 - confAdj; break;
    case "strongly_bear":  bull = 20;           bear = 65 - confAdj; break;
    default:               bull = 45;           bear = 35; break;
  }
  bull = Math.max(15, Math.min(80, bull));
  bear = Math.max(15, Math.min(75, bear));
  return { bull, bear };
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

function deriveVerdict(
  weighting: EvidenceWeighting,
  credit: string,
  bias: string,
  consensusStrength: string,
): DebateVerdict {
  if (credit === "extreme" && bias !== "bullish") return "bear_prevails";
  if (weighting === "strongly_bull" && consensusStrength === "strong") return "bull_prevails";
  if (weighting === "strongly_bear") return "bear_prevails";
  if (weighting === "modestly_bull" && credit !== "high") return "conditional_bull";
  if (weighting === "modestly_bear" || (credit === "high" && bias !== "bullish")) return "conditional_bear";
  if (consensusStrength === "conflicted") return "stalemate";
  return "stalemate";
}

// ─── Thesis builders ─────────────────────────────────────────────────────────

function buildBullCase(i: DebateInput): string {
  const oilLine = (i.isSaudi && i.oilPrice !== null && i.oilPrice >= 70)
    ? `Oil at $${i.oilPrice} provides fiscal capacity and SAMA policy flexibility. `
    : "";
  if (i.macroBias === "bullish" && i.creditStress === "low") {
    return `${oilLine}Macro is constructive — regime favors risk assets and credit conditions are benign. Earnings expectations are achievable without a credit headwind.`;
  }
  if (i.macroBias === "bullish" && i.creditStress === "moderate") {
    return `${oilLine}Macro bias is positive and credit is manageable — the regime supports selective deployment despite rate friction. Quality names have a margin of safety.`;
  }
  if (i.macroBias === "neutral") {
    return `${oilLine}Neutral macro means neither broad expansion nor contraction — select sectors are generating earnings growth that does not depend on a bull regime. Value exists in quality.`;
  }
  return `${oilLine}Despite the macro headwind, distressed valuations may price in excessive pessimism — a patient, high-conviction entry earns a return premium if the bear thesis is too extreme.`;
}

function buildBearCase(i: DebateInput): string {
  const oilLine = (i.isSaudi && i.oilPrice !== null && i.oilPrice < 70)
    ? `Oil at $${i.oilPrice} constrains fiscal capacity and pressures sovereign spending. `
    : "";
  if (i.creditStress === "extreme") {
    return `${oilLine}Extreme credit stress historically precedes earnings misses and multiple compression — holding through this phase amplifies drawdowns with limited upside cushion.`;
  }
  if (i.creditStress === "high") {
    return `${oilLine}High credit stress raises the cost of capital and compresses multiples — the earnings growth needed to justify current prices requires conditions that are currently absent.`;
  }
  if (i.macroBias === "bearish") {
    return `${oilLine}Macro is contracting — earnings revisions are likely to follow the deteriorating credit and liquidity environment. The exit from the current regime has historically been non-linear.`;
  }
  if (i.consensusStrength === "conflicted") {
    return `${oilLine}Consensus is genuinely conflicted — the historical pattern of conflicted signals precedes regime transition, which compresses multiples and rewards patience over early commitment.`;
  }
  return `Regime confidence is insufficient to absorb the downside risk — the opportunity cost of being wrong is higher than the opportunity cost of waiting.`;
}

function buildStrongestObjection(i: DebateInput): string {
  if (i.creditStress === "extreme" || i.creditStress === "high") {
    return "Credit stress makes the bull case dependent on a policy pivot that has not yet materialized.";
  }
  if (i.consensusStrength === "conflicted") {
    return "Consensus conflict means the bull thesis has no dominant corroborating signal — it rests on hope, not evidence.";
  }
  if (i.macroBias === "bearish") {
    return "The macro is against the bull — earnings growth from here requires conditions the current regime explicitly denies.";
  }
  if (i.regimeConf < 45) {
    return "Regime confidence is too low to trust the bull case — the setup might look different by the time conviction is warranted.";
  }
  return "The strongest objection is that the bull thesis prices in a soft landing that historical base rates do not support at this stage of the credit cycle.";
}

function buildVerdictRationale(verdict: DebateVerdict, weighting: EvidenceWeighting): string {
  switch (verdict) {
    case "bull_prevails":
      return "Bull prevails — evidence is strongly skewed positive and risks are manageable within the current regime.";
    case "bear_prevails":
      return "Bear prevails — credit and macro conditions make the downside scenario more probable than upside capture.";
    case "conditional_bull":
      return "Conditional bull — setup is forming but deployment requires a named confirmation before committing capital.";
    case "conditional_bear":
      return "Conditional bear — deterioration is building but not confirmed; the committee retains a defensive posture pending clarity.";
    case "stalemate":
      return "Committee stalemate — evidence is balanced; the decision rests on each allocator's risk tolerance and horizon.";
  }
}

// ─── Context injection ────────────────────────────────────────────────────────

const VERDICT_LABELS: Record<DebateVerdict, string> = {
  bull_prevails:     "bull prevails",
  bear_prevails:     "bear prevails",
  conditional_bull:  "conditional bull",
  conditional_bear:  "conditional bear",
  stalemate:         "stalemate — balanced evidence",
};

const WEIGHTING_LABELS: Record<EvidenceWeighting, string> = {
  strongly_bull:  "evidence strongly supports bull",
  modestly_bull:  "modest evidence advantage for bull",
  balanced:       "evidence balanced across both cases",
  modestly_bear:  "modest evidence advantage for bear",
  strongly_bear:  "evidence strongly supports bear",
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildCommitteeDebate(input: DebateInput): CommitteeDebateResult {
  const weighting        = deriveEvidenceWeighting(input);
  const { bull, bear }   = deriveProbabilities(weighting, input.regimeConf);
  const verdict          = deriveVerdict(weighting, input.creditStress, input.macroBias, input.consensusStrength);

  const bullCase           = buildBullCase(input);
  const bearCase           = buildBearCase(input);
  const strongestObjection = buildStrongestObjection(input);
  const verdictRationale   = buildVerdictRationale(verdict, weighting);

  const isAr = input.lang === "ar";

  const debateContext = isAr
    ? [
        `نقاش اللجنة الاستثمارية [${VERDICT_LABELS[verdict]}]:`,
        `حالة الصعود: ${bullCase.slice(0, 100)}`,
        `حالة الهبوط: ${bearCase.slice(0, 100)}`,
        `أقوى اعتراض: ${strongestObjection.slice(0, 80)}`,
        `الاحتمالات: صعود ${bull}٪ | هبوط ${bear}٪ | ${WEIGHTING_LABELS[weighting]}`,
        `الرد يجب أن يُقدّم كلا الطرفين ويُصوّت على الفائز.`,
      ].join(" — ").slice(0, 380)
    : [
        `Investment committee debate [${VERDICT_LABELS[verdict]}]:`,
        `Bull: ${bullCase.slice(0, 90)}`,
        `Bear: ${bearCase.slice(0, 90)}`,
        `Strongest objection: ${strongestObjection.slice(0, 75)}`,
        `Probability: bull ${bull}% vs bear ${bear}% — ${WEIGHTING_LABELS[weighting]}`,
        `Answer must surface both cases and state which prevails with reasoning.`,
      ].join(" | ").slice(0, 380);

  return {
    bullCase,
    bearCase,
    strongestObjection,
    evidenceWeighting:  weighting,
    bullProbability:    bull,
    bearProbability:    bear,
    verdict,
    verdictRationale,
    debateContext,
  };
}
