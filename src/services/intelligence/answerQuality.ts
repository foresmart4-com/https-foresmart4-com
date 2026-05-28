/**
 * Answer Quality Evaluation — Phase 57
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates AI answer quality using internal coherence signals and
 * governance-aware inputs. Provides advisory observations only.
 *
 * Quality states:
 *   robust_reasoning           — strong internal coherence; opposing case + invalidation present
 *   coherent_but_thin          — directional coherence without deep evidential support
 *   debated_reasoning          — material disagreement between signals; no auto-resolution
 *   confidence_risk            — stated confidence exceeds recent calibration track
 *   governance_constrained     — governance or firewall constraints dominate analytical output
 *   insufficient_quality_signal — heuristic response or no AI reply to evaluate
 *
 * Design rules:
 * - No truth claims — quality states are observational, not validation
 * - No certainty amplification — hedged language throughout
 * - No execution logic — quality evaluation is advisory only
 * - Governance remains superior — blocked/human_review_priority override quality
 * - Competing schools preserved — debated_reasoning surfaces disagreement without resolution
 *
 * Safety assertions:
 *   isTruthClaim       — always false; no factual verification
 *   isExecution        — always false; no broker or order logic
 *   isCertaintyAmplified — always false; hedged language enforced
 */

import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { GovernanceState } from "@/services/governance/governanceOS";
import type { CalibrationScore } from "@/services/learning/decisionScoring";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QualityState =
  | "robust_reasoning"           // strong internal coherence; well-structured opposing case
  | "coherent_but_thin"          // direction present; evidential depth limited
  | "debated_reasoning"          // competing signals both supported; disagreement preserved
  | "confidence_risk"            // confidence outpaces calibration track
  | "governance_constrained"     // governance or firewall active; output is maximally hedged
  | "insufficient_quality_signal";// heuristic or no AI reply to evaluate

export interface AnswerQualityInput {
  reasoningQuality: "strong" | "adequate" | "weak" | null;
  confidence: number;                              // 0-100
  confidenceLabel: "low" | "moderate" | "high";
  uncertaintyLevel: "likely" | "possible" | "uncertain" | "conflicting" | null;
  hasCaveats: boolean;
  hasOpposingCase: boolean;
  hasInvalidation: boolean;
  engine: "ai" | "heuristic";
  debateBalance: DebateBalance | null;
  hasMaterialDisagreement: boolean;
  firewallState: FirewallState;
  governanceState: GovernanceState;
  calibrationScore: CalibrationScore;
  ar: boolean;
}

export interface AnswerQualityResult {
  qualityState: QualityState;
  reasoningNote: string | null;    // 1 sentence; hedged; null for insufficient_signal
  confidenceLesson: string | null; // 1 sentence on confidence calibration; null when not applicable
  contextString: string;           // compact ≤120 chars for Genesis context injection
  // Safety assertions — always enforced; no exceptions
  readonly isTruthClaim: false;
  readonly isExecution: false;
  readonly isCertaintyAmplified: false;
}

// ─── Signal scoring ───────────────────────────────────────────────────────────

interface QualitySignals {
  robustScore: number;
  thinScore: number;
  debatedScore: number;
  confidenceRiskScore: number;
  governanceScore: number;
}

function scoreQualitySignals(input: AnswerQualityInput): QualitySignals {
  const {
    reasoningQuality, confidence, hasCaveats, hasOpposingCase,
    hasInvalidation, debateBalance, hasMaterialDisagreement,
    firewallState, governanceState, calibrationScore,
  } = input;

  // Robust reasoning: strong structure across all components
  let robustScore = 0;
  if (reasoningQuality === "strong") robustScore += 3;
  if (hasOpposingCase) robustScore += 2;
  if (hasInvalidation) robustScore += 2;
  if (hasCaveats) robustScore += 1;
  if (calibrationScore === "well_calibrated" || calibrationScore === "moderately_calibrated") robustScore += 1;

  // Thin reasoning: direction present but support shallow
  let thinScore = 0;
  if (reasoningQuality === "weak") thinScore += 3;
  if (reasoningQuality === "adequate" && !hasOpposingCase) thinScore += 2;
  if (!hasInvalidation && reasoningQuality !== "strong") thinScore += 1;
  if (calibrationScore === "insufficient_data") thinScore += 1;

  // Debated reasoning: competing signals both present
  let debatedScore = 0;
  if (hasMaterialDisagreement) debatedScore += 3;
  if (debateBalance === "contested") debatedScore += 3;
  if (input.uncertaintyLevel === "conflicting") debatedScore += 2;
  if (hasCaveats && hasMaterialDisagreement) debatedScore += 1;

  // Confidence risk: stated confidence outpaces calibration
  let confidenceRiskScore = 0;
  if (confidence > 75 && calibrationScore === "weakly_calibrated") confidenceRiskScore += 4;
  if (confidence > 70 && calibrationScore === "weakly_calibrated") confidenceRiskScore += 2;
  if (input.uncertaintyLevel === "conflicting" && confidence > 65) confidenceRiskScore += 2;
  if (reasoningQuality === "weak" && confidence > 60) confidenceRiskScore += 1;

  // Governance constraint: firewall/governance overrides
  let governanceScore = 0;
  if (firewallState === "blocked") governanceScore += 5;
  if (firewallState === "constrained") governanceScore += 3;
  if (governanceState === "human_review_priority") governanceScore += 4;
  if (governanceState === "conflict_detected") governanceScore += 3;
  if (governanceState === "elevated_uncertainty") governanceScore += 2;
  if (firewallState === "caution") governanceScore += 1;

  return { robustScore, thinScore, debatedScore, confidenceRiskScore, governanceScore };
}

// ─── Quality state derivation ─────────────────────────────────────────────────

function deriveQualityState(input: AnswerQualityInput, signals: QualitySignals): QualityState {
  // Heuristic engine — no AI reply structure to evaluate
  if (input.engine === "heuristic") return "insufficient_quality_signal";

  // Governance supremacy: blocked firewall or human review priority
  if (input.firewallState === "blocked" || input.governanceState === "human_review_priority") {
    return "governance_constrained";
  }

  const { robustScore, thinScore, debatedScore, confidenceRiskScore, governanceScore } = signals;

  // Governance constraint overrides other signals
  if (governanceScore >= 4) return "governance_constrained";

  // Confidence risk: high confidence + weak calibration
  if (confidenceRiskScore >= 4) return "confidence_risk";

  // Debated reasoning: competing signals both supported
  if (debatedScore >= 4) return "debated_reasoning";

  // Robust reasoning: strong multi-component structure
  if (robustScore >= 6) return "robust_reasoning";

  // Thin reasoning: shallow support
  if (thinScore >= 3) return "coherent_but_thin";

  // Default: coherent but evidentially thin
  return "coherent_but_thin";
}

// ─── Note builders ────────────────────────────────────────────────────────────

function buildReasoningNote(qualityState: QualityState, input: AnswerQualityInput, ar: boolean): string | null {
  if (qualityState === "insufficient_quality_signal") return null;

  if (ar) {
    switch (qualityState) {
      case "robust_reasoning":
        return "بنية الاستدلال تُظهر تماسكاً متعدد الإشارات — الحالة المضادة وشرط الإلغاء كلاهما موجودان؛ الأدلة تدعم الاتجاه بشكل معقول.";
      case "coherent_but_thin":
        return "الاتجاه التحليلي متماسك لكن عمق الدليل الداعم يبدو محدوداً — التفسيرات المنافسة قد تستحق الاهتمام.";
      case "debated_reasoning":
        return "خلاف جوهري بين الإشارات التحليلية — كلا الاتجاهين مدعومان بالسياق الحالي؛ لا حسم تلقائي مناسب.";
      case "confidence_risk":
        return "مستوى الثقة المُعلن يتجاوز مسار المعايرة الأخير — يُلاحَظ خطر المبالغة؛ الترسيخ المحافظ موصى به.";
      case "governance_constrained":
        return "قيود الحوكمة أو جدار الحماية نشطة — مخرجات التحليل تطبّق الحد الأقصى من التحوط.";
    }
  } else {
    switch (qualityState) {
      case "robust_reasoning":
        return "Reasoning structure shows cross-signal coherence — opposing case and invalidation condition are both present; evidence reasonably supports direction.";
      case "coherent_but_thin":
        return "Analytical direction is coherent but supporting evidence depth appears limited — competing interpretations may warrant attention.";
      case "debated_reasoning":
        return "Material disagreement between analytical signals — both directions have current contextual support; no automatic resolution is appropriate.";
      case "confidence_risk":
        return "Stated confidence exceeds recent calibration track — overshoot risk noted; conservative anchoring is advisable.";
      case "governance_constrained":
        return "Governance or firewall constraints are active — analytical outputs apply maximum hedging throughout.";
    }
  }
}

function buildConfidenceLesson(qualityState: QualityState, input: AnswerQualityInput, ar: boolean): string | null {
  if (qualityState === "insufficient_quality_signal" || qualityState === "robust_reasoning") return null;

  if (ar) {
    switch (qualityState) {
      case "confidence_risk":
        return "تاريخ المعايرة يُشير إلى احتمال المبالغة — نمط ملاحَظ، لا مؤكَّد؛ الثقة يجب أن تعكس قوة الأدلة الحالية.";
      case "debated_reasoning":
        return "توازن النقاش المتنازع عليه يُحدّد سقف الثقة — الأدلة لا تحسم الاتجاه بوضوح في هذه المرحلة.";
      case "coherent_but_thin":
        return "عمق الأدلة المحدود يُشير إلى تحفظ في الثقة — الثقة ينبغي أن تعكس جودة الأدلة المتاحة.";
      default:
        return null;
    }
  } else {
    switch (qualityState) {
      case "confidence_risk":
        return "Calibration history suggests possible overshoot — pattern noted, not asserted; confidence should reflect current evidence strength.";
      case "debated_reasoning":
        return "Contested debate balance limits the confidence ceiling — evidence does not clearly resolve direction at this stage.";
      case "coherent_but_thin":
        return "Limited evidence depth suggests confidence caution — confidence should reflect available evidence quality.";
      default:
        return null;
    }
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(qualityState: QualityState, input: AnswerQualityInput): string {
  if (qualityState === "insufficient_quality_signal") return "";

  const stateLabel = qualityState.replace(/_/g, " ");

  switch (qualityState) {
    case "robust_reasoning":
      return `Reasoning quality: robust | coherent with opposing case + invalidation`.slice(0, 120);
    case "debated_reasoning":
      return `Reasoning quality: debated | ${input.hasMaterialDisagreement ? "material disagreement active" : "contested signals"}`.slice(0, 120);
    case "confidence_risk":
      return `Confidence note: risk | weakly calibrated; stated ${input.confidence}% may overstate evidence`.slice(0, 120);
    case "governance_constrained":
      return `Governance constraint: active | maximum hedging; ${input.firewallState !== "open" ? `firewall ${input.firewallState}` : input.governanceState.replace(/_/g, " ")}`.slice(0, 120);
    default:
      return `Reasoning quality: ${stateLabel}`.slice(0, 120);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeAnswerQuality(input: AnswerQualityInput): AnswerQualityResult {
  const signals = scoreQualitySignals(input);
  const qualityState = deriveQualityState(input, signals);
  const reasoningNote = buildReasoningNote(qualityState, input, input.ar);
  const confidenceLesson = buildConfidenceLesson(qualityState, input, input.ar);
  const contextString = buildContextString(qualityState, input);

  return {
    qualityState,
    reasoningNote,
    confidenceLesson,
    contextString,
    isTruthClaim: false,
    isExecution: false,
    isCertaintyAmplified: false,
  };
}
