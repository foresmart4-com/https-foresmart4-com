/**
 * Trust & Strategy Intelligence Engine — Phase 25 + 26
 * Pure function — no network calls, no AI calls, no localStorage writes.
 *
 * Phase 25 — Trust Intelligence:
 *   Computes TrustState: a TREND-AWARE trust classification that extends
 *   Phase-24's CalibrationScore with ECE trajectory and outcome pattern.
 *
 * Phase 26 — Strategy Intelligence:
 *   Derives StrategyPosture from regime, strategic bias, cross-asset signals,
 *   and conflict data. Frames the ANALYTICAL POSTURE that fits the evidence.
 *
 * Design rules:
 * - Conservative: insufficient_evidence / unclassified are the defaults
 * - No fake edge: never claims a strategy "works" or has verified returns
 * - No trading: posture labels are narrative framing, not execution signals
 * - Evidence-linked: every label must follow from specific observable inputs
 * - Advisory only: all output language is conditional, probabilistic
 */

import type { DecisionScoreResult } from "@/services/learning/decisionScoring";
import type { StrategicSynthesis } from "@/services/intelligence/strategicEngine";
import type { OutcomeSummary } from "@/services/learning/outcomeEngine";

// ─── Phase 25: Trust Intelligence ────────────────────────────────────────────

export type TrustState =
  | "stable_calibration"     // consistent evidence; no degradation; well-calibrated
  | "improving_calibration"  // recent ECE better than overall; outcomes trending confirmed
  | "mixed_calibration"      // some good, some weak; no clear trend
  | "fragile_calibration"    // weakly calibrated, overshoot, or pattern of invalidations
  | "insufficient_evidence"; // not enough data to classify; conservative default

export interface TrustStateResult {
  state: TrustState;
  stateReason: string;       // 1-sentence advisory note
  pressureNote: string | null; // additional pressure instruction when fragile
}

// ─── Phase 26: Strategy Intelligence ─────────────────────────────────────────

export type StrategyPosture =
  | "momentum_constructive"   // risk-on + aligned signals + high conviction
  | "trend_following"         // directional clarity, moderate conviction
  | "defensive_preservation"  // risk-off, multiple stress signals, capital preservation
  | "macro_sensitive"         // transition regime, mixed cross-asset, reduced conviction
  | "watch_and_wait"          // conflicting signals, low conviction, patience rational
  | "unclassified";           // insufficient regime data for posture

export interface StrategyPostureResult {
  posture: StrategyPosture;
  postureReason: string;     // 1-sentence advisory framing
  suitabilityNote: string;   // what this posture implies for analytical approach
}

// ─── Combined output ──────────────────────────────────────────────────────────

export interface TrustStrategyResult {
  trustState: TrustStateResult;
  strategyPosture: StrategyPostureResult;
  contextString: string;     // compact ≤220 chars for AI decisionCtx injection
  postureForUI: string;      // short UI label for StrategicBiasPanel
  hasSignificantSignal: boolean;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface TrustStrategyInput {
  decisionScore: DecisionScoreResult;  // Phase-24
  strategicSynthesis: StrategicSynthesis; // Phase-22
  outcomeSummary: OutcomeSummary;      // Phase-23
  recentEceVal: number;                // ece(7 * 86400000) — 7-day window
  overallEceVal: number;               // ece() — all-time
  isDrifting: boolean;
  marketRegime: string;
  ar: boolean;
}

// ─── Phase 25: TrustState computation ────────────────────────────────────────

function computeTrustState(input: TrustStrategyInput): TrustStateResult {
  const { decisionScore, outcomeSummary, recentEceVal, overallEceVal, isDrifting, ar } = input;
  const { score, trustProfile } = decisionScore;
  const actionable = outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated;

  // insufficient_evidence: Phase-24 is insufficient AND no actionable outcomes
  if (score === "insufficient_data" && actionable < 2) {
    return {
      state: "insufficient_evidence",
      stateReason: ar
        ? "أدلة المعايرة محدودة — لا يوجد تاريخ نتائج كافٍ لتصنيف حالة الثقة"
        : "Calibration evidence limited — insufficient outcome history to classify trust state",
      pressureNote: null,
    };
  }

  // fragile_calibration: weak calibration score, overshoot signal, or pattern of invalidations
  if (
    score === "weakly_calibrated" ||
    (trustProfile.hasOvershootSignal && actionable >= 3) ||
    (outcomeSummary.invalidated >= 2 && actionable >= 3 && outcomeSummary.invalidationRatio > 0.4)
  ) {
    return {
      state: "fragile_calibration",
      stateReason: ar
        ? "معايرة هشة — ميل للمبالغة في الثقة أو نمط إضعاف أطروحات لوحظ"
        : "Fragile calibration — overshoot tendency or thesis weakening pattern observed",
      pressureNote: ar
        ? "حافظ على الترسيخ المحافظ؛ ثقة هشة تاريخياً"
        : "Maintain conservative anchoring; trust state historically fragile",
    };
  }

  // improving_calibration: recent ECE materially better than overall AND outcomes trending positive
  const eceImproving = overallEceVal > 0.08 && recentEceVal < overallEceVal * 0.80;
  const outcomesPositive = outcomeSummary.confirmed > outcomeSummary.weakened + outcomeSummary.invalidated && outcomeSummary.confirmed >= 2;
  if ((eceImproving || outcomesPositive) && score !== "weakly_calibrated" && !isDrifting) {
    return {
      state: "improving_calibration",
      stateReason: ar
        ? "معايرة في تحسن — أحدث نتائج الأطروحات تؤكد التوجهات"
        : "Calibration improving — recent thesis outcomes trending confirmatory",
      pressureNote: null,
    };
  }

  // stable_calibration: well-calibrated with no degradation signal
  if (score === "well_calibrated" && !isDrifting && !trustProfile.hasOvershootSignal) {
    return {
      state: "stable_calibration",
      stateReason: ar
        ? "معايرة مستقرة — مستوى الثقة تاريخياً متوافق مع النتائج"
        : "Stable calibration — confidence level historically aligned with outcomes",
      pressureNote: null,
    };
  }

  // mixed_calibration: everything else
  return {
    state: "mixed_calibration",
    stateReason: ar
      ? "معايرة مختلطة — بعض التوافق ولكن مع تذبذب؛ الترسيخ المعتدل مناسب"
      : "Mixed calibration — some alignment but with variation; moderate anchoring appropriate",
    pressureNote: null,
  };
}

// ─── Phase 26: StrategyPosture computation ────────────────────────────────────

function computeStrategyPosture(input: TrustStrategyInput): StrategyPostureResult {
  const { strategicSynthesis, isDrifting, marketRegime, ar } = input;
  const { bias, hasConflict, opportunityDrivers, riskDrivers } = strategicSynthesis;

  // Defensive: multiple risk signals, drift, or defensive/uncertain bias with stress
  const highSeverityCount = input.outcomeSummary.invalidated + (isDrifting ? 1 : 0);
  if (
    bias === "defensive" ||
    (bias === "uncertain" && highSeverityCount >= 2) ||
    isDrifting
  ) {
    return {
      posture: "defensive_preservation",
      postureReason: ar
        ? "إشارات مخاطر متعددة نشطة — توجه دفاعي مع حفاظ على رأس المال مناسب"
        : "Multiple risk signals active — defensive posture with capital preservation focus appropriate",
      suitabilityNote: ar
        ? "ركّز على الأصول الدفاعية وإدارة المخاطر قبل البحث عن فرص جديدة"
        : "Focus on defensive assets and risk management before seeking new opportunities",
    };
  }

  // Watch and wait: conflicting signals or very low conviction
  const isUnclear = bias === "uncertain" || (bias === "neutral" && hasConflict);
  if (isUnclear || (strategicSynthesis.conflictNote && opportunityDrivers.length === 0)) {
    return {
      posture: "watch_and_wait",
      postureReason: ar
        ? "إشارات متعارضة أو قناعة منخفضة — الانتظار والمراقبة قد يكون أكثر عقلانية"
        : "Conflicting signals or low conviction — watch-and-wait may be the rational analytical posture",
      suitabilityNote: ar
        ? "راقب التطورات دون اتخاذ مواقف جديدة حتى يتضح النظام السوقي"
        : "Monitor developments without committing to new positions until regime clarity improves",
    };
  }

  // Macro sensitive: transition regime or macro uncertainty
  const isMacroTransition = /macro_transition|transition/i.test(marketRegime);
  if (isMacroTransition || (hasConflict && bias !== "constructive")) {
    return {
      posture: "macro_sensitive",
      postureReason: ar
        ? "نظام انتقالي أو تعارض كلي-تقني — وضع حساس للماكرو مع قناعة مخففة"
        : "Transition regime or macro-technical conflict — macro-sensitive posture with reduced directional conviction",
      suitabilityNote: ar
        ? "تتبّع المحركات الكلية عن كثب؛ تجنب المراكز عالية المخاطرة حتى يستقر النظام"
        : "Track macro drivers closely; avoid high-conviction positioning until regime stabilises",
    };
  }

  // Momentum constructive: constructive bias, high confidence, no conflicts, multiple positive drivers
  if (
    bias === "constructive" &&
    opportunityDrivers.length >= 2 &&
    riskDrivers.length <= 1 &&
    !hasConflict
  ) {
    return {
      posture: "momentum_constructive",
      postureReason: ar
        ? "كلي وتقنية وأصول متقاطعة كلها تدعم الحالة الأساسية — توضع زخمي بنّاء محتمل"
        : "Macro, technical, and cross-asset all supporting the base case — momentum-constructive posture may fit",
      suitabilityNote: ar
        ? "الزخم الاتجاهي موجود؛ الإضافة إلى التحيّز عند انتفاء الذخيرة مناسب نسبياً"
        : "Directional momentum present; adding to bias on pullbacks is relatively suitable under this setup",
    };
  }

  // Trend following: constructive/opportunistic with moderate conviction
  if (bias === "constructive" || bias === "opportunistic") {
    return {
      posture: "trend_following",
      postureReason: ar
        ? "وضوح اتجاهي معتدل — توجه اتباع الاتجاه مناسب مع مراقبة الإشارات المعاكسة"
        : "Moderate directional clarity — trend-following posture appropriate with monitoring for counter-signals",
      suitabilityNote: ar
        ? "تابع التحيّز الاتجاهي مع إدارة صارمة للمخاطر وضع شرط الإلغاء"
        : "Follow the directional bias with strict risk management and clear invalidation conditions in mind",
    };
  }

  return {
    posture: "unclassified",
    postureReason: ar
      ? "لا يوجد نظام سوقي واضح كافٍ لتصنيف التوجه الاستراتيجي"
      : "Insufficient regime clarity for strategy posture classification",
    suitabilityNote: "",
  };
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(trust: TrustStateResult, posture: StrategyPostureResult, ar: boolean): string {
  const trustLabel = {
    stable_calibration: ar ? "مستقرة" : "stable",
    improving_calibration: ar ? "في تحسن" : "improving",
    mixed_calibration: ar ? "مختلطة" : "mixed",
    fragile_calibration: ar ? "هشة" : "fragile",
    insufficient_evidence: ar ? "بيانات غير كافية" : "insufficient data",
  }[trust.state];

  const parts = [
    `Trust: ${trustLabel} — ${trust.stateReason}`,
    `Posture: ${posture.posture.replace(/_/g, " ")} — ${posture.postureReason}`,
  ];
  if (trust.pressureNote) parts.push(trust.pressureNote);

  return parts.join("\n").slice(0, 300);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes trust state (Phase-25) and strategy posture (Phase-26) from existing signals.
 * Pure function — deterministic, no I/O, no storage.
 */
export function computeTrustAndStrategy(input: TrustStrategyInput): TrustStrategyResult {
  const trustState = computeTrustState(input);
  const strategyPosture = computeStrategyPosture(input);

  const contextString = buildContextString(trustState, strategyPosture, input.ar);

  // UI label for StrategicBiasPanel
  const POSTURE_LABEL_AR: Record<StrategyPosture, string> = {
    momentum_constructive: "زخم بنّاء",
    trend_following: "اتباع اتجاه",
    defensive_preservation: "دفاعي",
    macro_sensitive: "حساس للماكرو",
    watch_and_wait: "انتظار ومراقبة",
    unclassified: "",
  };
  const POSTURE_LABEL_EN: Record<StrategyPosture, string> = {
    momentum_constructive: "Momentum / Constructive",
    trend_following: "Trend Following",
    defensive_preservation: "Defensive / Preservation",
    macro_sensitive: "Macro Sensitive",
    watch_and_wait: "Watch & Wait",
    unclassified: "",
  };
  const postureForUI = input.ar
    ? POSTURE_LABEL_AR[strategyPosture.posture]
    : POSTURE_LABEL_EN[strategyPosture.posture];

  const hasSignificantSignal =
    trustState.state === "fragile_calibration" ||
    trustState.state === "improving_calibration" ||
    strategyPosture.posture !== "unclassified";

  return { trustState, strategyPosture, contextString, postureForUI, hasSignificantSignal };
}
