/**
 * Decision Scoring & Calibration Intelligence — Phase 24
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Integrates ECE (trade-level), thesis outcomes (Phase-23), and
 * memory-agent track record into a unified calibration score.
 *
 * Design rules:
 * - Conservative: defaults to insufficient_data when evidence is thin
 * - No fake accuracy: never claims measured win rates without resolved data
 * - No overfit: pressure capped at ±4 pts, requires explicit evidence
 * - Bounded: operates on existing bounded memory, adds no new storage
 * - Additive: complements Phase-23 outcome pressure, never doubles it
 */

import type { OutcomeSummary } from "@/services/learning/outcomeEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CalibrationScore =
  | "well_calibrated"       // ECE low, thesis outcomes confirming, no drift
  | "moderately_calibrated" // mixed signals, some weakening, ECE moderate
  | "weakly_calibrated"     // ECE high, or drift, or pattern of invalidations
  | "insufficient_data";    // not enough closed outcomes to score meaningfully

export interface TrustProfile {
  confirmationRatio: number;    // 0-1: confirmed / actionable
  invalidationRatio: number;    // 0-1: invalidated / actionable
  hasOvershootSignal: boolean;  // ECE high + confidence modifier below baseline
  hasUndershootSignal: boolean; // confidence modifier well above baseline
  sampleSize: "adequate" | "limited" | "none";
}

export interface ScoringInput {
  eceVal: number;               // from selfLearningEngine.ece()
  tradeCount: number;           // total closed trades from selfLearningEngine
  isDrifting: boolean;          // from driftReport().isDrifting
  confModifier: number;         // from memoryAgent.confidenceModifier()
  outcomeSummary: OutcomeSummary; // from Phase-23 inferThesisOutcomes()
  thesisResolved: number;       // from thesisMemory.outcomeStats().resolved
  thesisAccuracy: number;       // from thesisMemory.outcomeStats().accuracy (0-100)
  ar: boolean;
}

export interface DecisionScoreResult {
  score: CalibrationScore;
  trustProfile: TrustProfile;
  calibrationPressure: number;    // -4 to +3 pts additive to existing pressure
  calibrationContext: string;     // compact string for AI decisionCtx injection
  narrativeHint: string;          // 1-sentence advisory description (UI / narrative)
  hasActionableSignal: boolean;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const ECE_WELL       = 0.12;
const ECE_MODERATE   = 0.22;
const ECE_WEAK       = 0.28;
const OVERSHOOT_ECE  = 0.18;  // ECE above this = potential overshoot
const OVERSHOOT_MOD  = 0.93;  // confModifier below this = below-baseline track record
const UNDERSHOOT_MOD = 1.08;  // confModifier above this = well above baseline

// ─── Trust profile ────────────────────────────────────────────────────────────

function buildTrustProfile(input: ScoringInput): TrustProfile {
  const { outcomeSummary, eceVal, confModifier, tradeCount, thesisResolved } = input;
  const actionable = outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated;

  const confirmationRatio = actionable > 0 ? outcomeSummary.confirmed / actionable : 0;
  const invalidationRatio = actionable > 0 ? outcomeSummary.invalidated / actionable : 0;
  const hasOvershootSignal  = eceVal > OVERSHOOT_ECE && confModifier < OVERSHOOT_MOD;
  const hasUndershootSignal = confModifier > UNDERSHOOT_MOD;

  const totalEvidence = tradeCount + thesisResolved + actionable;
  const sampleSize: TrustProfile["sampleSize"] =
    totalEvidence >= 5 ? "adequate" :
    totalEvidence >= 2 ? "limited" : "none";

  return { confirmationRatio, invalidationRatio, hasOvershootSignal, hasUndershootSignal, sampleSize };
}

// ─── Score derivation ─────────────────────────────────────────────────────────

function deriveScore(input: ScoringInput, profile: TrustProfile): CalibrationScore {
  const { eceVal, tradeCount, isDrifting, thesisResolved, thesisAccuracy, outcomeSummary } = input;
  const actionable = outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated;

  // insufficient_data: not enough closed outcomes to score meaningfully
  if (profile.sampleSize === "none") return "insufficient_data";
  if (tradeCount < 3 && thesisResolved < 2 && actionable < 2) return "insufficient_data";

  // weakly_calibrated: clear overconfidence, drift, or pattern of invalidations
  if (isDrifting) return "weakly_calibrated";
  if (eceVal > ECE_WEAK && tradeCount >= 5) return "weakly_calibrated";
  if (profile.invalidationRatio > 0.5 && actionable >= 3) return "weakly_calibrated";
  if (thesisResolved >= 4 && thesisAccuracy < 30) return "weakly_calibrated";

  // well_calibrated: low ECE or small sample, no invalidation pattern, no drift
  const eceOk = tradeCount < 3 || eceVal < ECE_WELL; // small sample → treat as ok
  const thesisOk = thesisResolved < 3 || thesisAccuracy >= 50;
  const noInvalidationPattern = actionable < 3 || profile.invalidationRatio <= 0.2;
  if (eceOk && thesisOk && noInvalidationPattern && !profile.hasOvershootSignal) {
    return "well_calibrated";
  }

  return "moderately_calibrated";
}

// ─── Calibration pressure ─────────────────────────────────────────────────────

// Note: Phase-23 already injects outcome pressure for thesis patterns.
// Phase-24 adds ECE-based and overshoot-based pressure — additive but bounded.

function computeCalibrationPressure(score: CalibrationScore, profile: TrustProfile): number {
  if (profile.sampleSize === "none") return 0;

  let pressure = 0;

  // ECE-based pressure (separate from Phase-23 thesis pressure)
  if (profile.hasOvershootSignal) pressure -= 3;
  if (profile.hasUndershootSignal) pressure += 2;

  // Confirmation pattern support
  if (score === "well_calibrated" && profile.confirmationRatio > 0.7 && profile.sampleSize === "adequate") pressure += 1;
  if (score === "weakly_calibrated" && profile.invalidationRatio > 0.4) pressure -= 2;

  return Math.max(-4, Math.min(3, pressure));
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildCalibrationContext(score: CalibrationScore, profile: TrustProfile, input: ScoringInput, ar: boolean): string {
  if (score === "insufficient_data") {
    return ar
      ? "أدلة المعايرة محدودة — الثقة تعكس جودة الأدلة فقط"
      : "Calibration evidence limited — confidence reflects evidence quality only";
  }
  if (score === "well_calibrated" && !profile.hasOvershootSignal) {
    return ar
      ? "الثقة متوافقة تاريخياً مع النتائج — استمرارية الأطروحة سليمة"
      : "Confidence historically aligned with outcomes — thesis continuity intact";
  }
  if (profile.hasOvershootSignal) {
    return ar
      ? "ميل للمبالغة في الثقة لوحظ — حافظ على الترسيخ المحافظ"
      : "Confidence overshoot tendency observed — maintain conservative anchoring";
  }
  if (input.isDrifting) {
    return ar
      ? "انحراف في الأداء نشط — المعايرة الأخيرة أدنى من الأساس"
      : "Performance drift active — recent calibration below baseline";
  }
  if (score === "weakly_calibrated") {
    return ar
      ? "نمط إضعاف أطروحات أخير — تقليل الأنكر بتحفظ موصى"
      : "Recent thesis weakening pattern — modestly reduce confidence anchor";
  }
  // moderately_calibrated
  return ar
    ? "المعايرة مختلطة — بعض الإضعاف لوحظ؛ الترسيخ المحافظ مناسب"
    : "Calibration mixed — some weakening observed; conservative anchoring appropriate";
}

function buildNarrativeHint(score: CalibrationScore, profile: TrustProfile, ar: boolean): string {
  const scoreLabel: Record<CalibrationScore, { ar: string; en: string }> = {
    well_calibrated:      { ar: "معايرة جيدة",       en: "well-calibrated" },
    moderately_calibrated:{ ar: "معايرة متوسطة",     en: "moderately calibrated" },
    weakly_calibrated:    { ar: "معايرة ضعيفة",      en: "weakly calibrated" },
    insufficient_data:    { ar: "بيانات غير كافية",  en: "insufficient data" },
  };
  const label = ar ? scoreLabel[score].ar : scoreLabel[score].en;
  const suffix = profile.sampleSize === "none"
    ? (ar ? " — لا تاريخ كافٍ بعد" : " — no sufficient history yet")
    : profile.hasOvershootSignal
      ? (ar ? " — مع ميل للمبالغة بالثقة" : " — with overshoot tendency")
      : profile.confirmationRatio > 0.6
        ? (ar ? " — نمط تأكيد أطروحات" : " — thesis confirming pattern")
        : "";
  return label + suffix;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes a unified decision calibration score from all available signals.
 * Pure function — deterministic, no I/O, no new storage.
 */
export function computeDecisionScore(input: ScoringInput): DecisionScoreResult {
  const trustProfile = buildTrustProfile(input);
  const score = deriveScore(input, trustProfile);
  const calibrationPressure = computeCalibrationPressure(score, trustProfile);
  const calibrationContext = buildCalibrationContext(score, trustProfile, input, input.ar);
  const narrativeHint = buildNarrativeHint(score, trustProfile, input.ar);
  const hasActionableSignal = score !== "insufficient_data" && (
    score === "weakly_calibrated" || trustProfile.hasOvershootSignal || Math.abs(calibrationPressure) >= 2
  );

  return { score, trustProfile, calibrationPressure, calibrationContext, narrativeHint, hasActionableSignal };
}
