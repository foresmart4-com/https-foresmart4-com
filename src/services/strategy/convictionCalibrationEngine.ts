// Phase-88A: Conviction Calibration Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// DISTINCT FROM existing conviction modules:
//   arabicSemanticReasoningEngine.ts: detects conviction tier from Arabic text
//   adaptiveCalibrationEngine.ts: adjusts AI confidence based on track evidence
//   reasoningCalibration.ts: calibrates reasoning depth
//
// This module calibrates INVESTMENT CONVICTION for the committee:
//   rawConfidence → calibratedConviction (0-100) after applying:
//     1. Evidence quality adjustment (how strong is the supporting evidence?)
//     2. Uncertainty penalty (regime/policy uncertainty compresses conviction)
//     3. Regime confidence multiplier (how confident are we in the regime label?)
//     4. Thesis durability score (how long is this thesis expected to hold?)
//
// convictionProfile is used by portfolioLogicEngine to size positions and by
// genesis to calibrate how strongly to assert conclusions.
//
// Max conviction ceiling: never exceeds 82% for investment theses
// (institutional humility — markets can always surprise).
//
// Educational/advisory only. No autonomous execution. No broker data.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ThesisDurability =
  | "durable"          // thesis holds across multiple regime states; 12m+ horizon
  | "regime_dependent" // thesis valid only while current regime persists
  | "fragile"          // thesis depends on a specific near-term catalyst; high reversal risk
  | "event_driven";    // thesis driven by a discrete event (earnings, policy, etc.)

export type EvidenceQuality =
  | "strong"    // multiple high-authority sources; consistent signals; cross-confirmed
  | "moderate"  // some evidence but either limited sources or partially conflicting
  | "thin"      // single source or weak empirical grounding
  | "absent";   // no supporting evidence detected in context

export interface ConvictionProfile {
  rawConfidence:       number;        // 0-100: input confidence
  evidenceQuality:     EvidenceQuality;
  calibratedConviction:number;        // 0-100: after all adjustments
  maxConvictionCeiling:number;        // always ≤ 82
  thesisDurability:    ThesisDurability;
  calibrationFactors:  string[];      // what changed conviction and why
  convictionContext:   string;        // injectable ≤200 chars
}

// ─── Evidence quality inference ───────────────────────────────────────────────

const STRONG_EVIDENCE_PATTERNS = /\b(federal reserve|ecb|bis|imf|same data|confirmed by|cross.confirmed|peer.reviewed|historical precedent shows|track record|empirically|data support|fed.data|peer review)\b/i;
const THIN_EVIDENCE_PATTERNS   = /\b(rumor|anecdotal|heard|suggest|might|could be|possibly|unconfirmed|speculative|early signs|preliminary|شائعة|يُقال|ربما)\b/i;
const ABSENT_PATTERNS          = /\b(no evidence|unclear|uncertain|unknown|data unavailable|insufficient)\b/i;

function detectEvidenceQuality(question: string, ctx: string): EvidenceQuality {
  const text = `${question} ${ctx}`;
  if (ABSENT_PATTERNS.test(text)) return "absent";
  if (THIN_EVIDENCE_PATTERNS.test(text)) return "thin";
  if (STRONG_EVIDENCE_PATTERNS.test(text)) return "strong";
  return "moderate";
}

// ─── Thesis durability inference ─────────────────────────────────────────────

const DURABLE_PATTERNS       = /\b(structural|long.term|secular|multi.year|decade|fundamental shift|durable|persistent|إصلاح هيكلي|طويل الأمد|دائم)\b/i;
const FRAGILE_PATTERNS       = /\b(catalyst|event.driven|next (earnings|meeting|print|data)|short.term|tactical|near.term|relies on|conditional|يعتمد على|محفز)\b/i;
const REGIME_DEPENDENT_PATHS = /\b(as long as|while|provided|if .{0,30}(holds|continues|remains|stays)|regime.dependent|طالما|في حال)\b/i;
const EVENT_DRIVEN_PATHS     = /\b(earnings|fomc|cpi print|opec decision|elections|announcement|قرار أوبك|اجتماع|نتائج)\b/i;

function detectThesisDurability(question: string, ctx: string): ThesisDurability {
  const text = `${question} ${ctx}`;
  if (EVENT_DRIVEN_PATHS.test(text)) return "event_driven";
  if (FRAGILE_PATTERNS.test(text))   return "fragile";
  if (REGIME_DEPENDENT_PATHS.test(text)) return "regime_dependent";
  if (DURABLE_PATTERNS.test(text))   return "durable";
  return "regime_dependent";
}

// ─── Calibration adjustments ─────────────────────────────────────────────────

interface CalibrationInput {
  rawConfidence:    number;
  evidenceQuality:  EvidenceQuality;
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme";
  regimeConf:       number;       // 0-100
  durability:       ThesisDurability;
  consensusStrength:"strong" | "moderate" | "weak" | "conflicted";
}

const EVIDENCE_ADJUSTMENTS: Record<EvidenceQuality, number> = {
  strong:   +8,
  moderate:  0,
  thin:     -10,
  absent:   -20,
};

const UNCERTAINTY_PENALTIES: Record<string, number> = {
  low:      0,
  moderate: -5,
  high:    -15,
  extreme: -25,
};

const DURABILITY_ADJUSTMENTS: Record<ThesisDurability, number> = {
  durable:          +5,
  regime_dependent:  0,
  fragile:          -8,
  event_driven:    -12,
};

const MAX_CONVICTION_CEILING = 82;

function calibrateConviction(input: CalibrationInput): {
  calibrated: number;
  factors: string[];
  ceiling: number;
} {
  const factors: string[] = [];
  let adjusted = input.rawConfidence;

  // Evidence quality
  const evidAdj = EVIDENCE_ADJUSTMENTS[input.evidenceQuality];
  if (evidAdj !== 0) {
    adjusted += evidAdj;
    factors.push(`Evidence ${input.evidenceQuality}: ${evidAdj > 0 ? "+" : ""}${evidAdj} pts`);
  }

  // Uncertainty penalty
  const uncPenalty = UNCERTAINTY_PENALTIES[input.uncertaintyLevel] ?? 0;
  if (uncPenalty !== 0) {
    adjusted += uncPenalty;
    factors.push(`Uncertainty ${input.uncertaintyLevel}: ${uncPenalty} pts`);
  }

  // Regime confidence: compress if regime is uncertain (< 50%)
  if (input.regimeConf < 50) {
    const regAdj = -Math.round((50 - input.regimeConf) * 0.3);
    adjusted += regAdj;
    factors.push(`Low regime confidence (${input.regimeConf}%): ${regAdj} pts`);
  }

  // Thesis durability
  const durAdj = DURABILITY_ADJUSTMENTS[input.durability];
  if (durAdj !== 0) {
    adjusted += durAdj;
    factors.push(`Thesis ${input.durability}: ${durAdj > 0 ? "+" : ""}${durAdj} pts`);
  }

  // Consensus alignment bonus
  if (input.consensusStrength === "strong") {
    adjusted += 5;
    factors.push("Strong consensus: +5 pts");
  } else if (input.consensusStrength === "conflicted") {
    adjusted -= 8;
    factors.push("Conflicted consensus: -8 pts");
  }

  // Dynamic ceiling: fragile/event-driven theses have lower ceiling
  const ceilingOverride = input.durability === "fragile" ? 70
    : input.durability === "event_driven" ? 65
    : MAX_CONVICTION_CEILING;

  const calibrated = Math.max(0, Math.min(ceilingOverride, Math.round(adjusted)));
  return { calibrated, factors, ceiling: ceilingOverride };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildConvictionProfile(
  rawConfidence: number,
  question: string,
  ctx: string,
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme",
  regimeConf: number,
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted",
): ConvictionProfile {
  const evidenceQuality = detectEvidenceQuality(question, ctx);
  const durability      = detectThesisDurability(question, ctx);

  const { calibrated, factors, ceiling } = calibrateConviction({
    rawConfidence, evidenceQuality, uncertaintyLevel, regimeConf,
    durability, consensusStrength,
  });

  const summary = factors.length > 0
    ? factors.slice(0, 2).join("; ")
    : "No material adjustments.";

  const convictionContext = [
    `Conviction [${calibrated}%/${ceiling}% ceiling]:`,
    `Evidence: ${evidenceQuality}.`,
    `Thesis: ${durability.replace(/_/g, " ")}.`,
    summary,
  ].join(" ").slice(0, 200);

  return {
    rawConfidence,
    evidenceQuality,
    calibratedConviction: calibrated,
    maxConvictionCeiling:  ceiling,
    thesisDurability:      durability,
    calibrationFactors:    factors,
    convictionContext,
  };
}
