/**
 * Adaptive Learning Governance — Phase 38
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates whether current learning signals are trustworthy and safe to include
 * in governing how the AI calibrates its future reasoning.
 *
 * Governance labels:
 *   learning_active      — signals reliable; governed learning updates are safe
 *   learning_cautious    — mixed signals; conservative learning posture appropriate
 *   learning_paused      — constraint flags active; governed updates deferred
 *   learning_insufficient — insufficient data to evaluate learning quality
 *   learning_locked      — firewall blocked; all learning updates suspended
 *
 * Safety assertions (always enforced, always false):
 *   isSelfModifying      — this module NEVER modifies AI model weights
 *   isModelRetraining    — this module NEVER triggers model retraining
 *   isAutonomousEvolution — no autonomous learning path exists; all gates deterministic
 *   firewallBypassed     — firewall blocked state always maps to learning_locked
 *
 * Design rules:
 * - Governed learning only: all gates are explicit and deterministic
 * - No self-training, no model retraining, no autonomous evolution
 * - Firewall blocked always overrides all other gates (never bypassed)
 * - Honest default: learning_insufficient when evidence is too thin
 * - Context injection purpose: informs AI of governed learning state
 *   so it can calibrate reasoning quality — never to enable self-modification
 */

import type { OutcomeSummary } from "@/services/learning/outcomeEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { AttributionLabel } from "@/services/learning/outcomeAttribution";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LearningGovernanceLabel =
  | "learning_active"        // signals trustworthy; governed updates permitted
  | "learning_cautious"      // mixed signals; conservative posture appropriate
  | "learning_paused"        // constraint flags active; updates deferred
  | "learning_insufficient"  // insufficient data for learning quality assessment
  | "learning_locked";       // firewall blocked; all updates suspended

export type LearningConstraint =
  | "firewall_blocked"      // decision firewall blocked — overrides all other gates
  | "fragile_calibration"   // trust state fragile; learning quality uncertain
  | "insufficient_evidence" // not enough resolved outcomes to evaluate
  | "mixed_attribution"     // attribution mixed; signal quality limited
  | "drift_detected"        // performance drift degrades learning reliability
  | "overshoot_pattern";    // systematic overshoot reduces learning value

export interface AdaptiveLearningGovernanceInput {
  outcomeSummary: OutcomeSummary;
  calibrationScore: CalibrationScore;
  trustState: TrustState;
  firewallState: FirewallState;
  attributionLabel: AttributionLabel;
  eceVal: number;
  isDrifting: boolean;
  thesisCount: number;
  hasOvershootSignal: boolean;
  ar: boolean;
}

export interface AdaptiveLearningGovernanceResult {
  label: LearningGovernanceLabel;
  constraints: LearningConstraint[];
  canUpdateLearning: boolean;    // true only for active/cautious; never for locked/paused
  summary: string;               // 1-2 sentences, hedged language
  contextString: string;         // compact ≤120 chars for AI injection; empty when insufficient
  // Safety assertions — always false; present for audit and type-level documentation
  readonly isSelfModifying: false;
  readonly isModelRetraining: false;
  readonly isAutonomousEvolution: false;
  readonly firewallBypassed: false;
}

// ─── Constraint derivation ────────────────────────────────────────────────────

function deriveConstraints(input: AdaptiveLearningGovernanceInput): LearningConstraint[] {
  const constraints: LearningConstraint[] = [];
  const { firewallState, trustState, calibrationScore, attributionLabel,
    isDrifting, hasOvershootSignal, outcomeSummary, thesisCount } = input;

  // Firewall block — highest-priority gate; always checked first
  if (firewallState === "blocked") {
    constraints.push("firewall_blocked");
    return constraints; // No other constraints matter when firewall is blocked
  }

  // Trust / calibration quality gates
  if (trustState === "fragile_calibration") {
    constraints.push("fragile_calibration");
  }
  if (
    trustState === "insufficient_evidence" ||
    calibrationScore === "insufficient_data" ||
    thesisCount === 0 ||
    (outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated) === 0
  ) {
    constraints.push("insufficient_evidence");
  }

  // Attribution quality gate
  if (attributionLabel === "mixed_attribution" || attributionLabel === "luck_or_noise") {
    constraints.push("mixed_attribution");
  }

  // Drift and overshoot pattern gates
  if (isDrifting) {
    constraints.push("drift_detected");
  }
  if (hasOvershootSignal) {
    constraints.push("overshoot_pattern");
  }

  return constraints;
}

// ─── Label derivation ─────────────────────────────────────────────────────────

function deriveLabel(
  constraints: LearningConstraint[],
  input: AdaptiveLearningGovernanceInput,
): LearningGovernanceLabel {
  const { calibrationScore, trustState, outcomeSummary,
    thesisCount, attributionLabel } = input;

  // Hard block — firewall overrides everything
  if (constraints.includes("firewall_blocked")) return "learning_locked";

  // Insufficient data — cannot evaluate
  if (
    constraints.includes("insufficient_evidence") &&
    thesisCount < 2 &&
    (outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated) < 2
  ) {
    return "learning_insufficient";
  }

  // Multiple hard constraints — pause
  const hardCount = constraints.filter((c) =>
    c === "fragile_calibration" || c === "drift_detected" || c === "overshoot_pattern",
  ).length;
  if (hardCount >= 2) return "learning_paused";

  // Single hard constraint with thin outcomes — pause
  if (
    constraints.includes("fragile_calibration") &&
    (outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated) < 2
  ) {
    return "learning_paused";
  }

  // Mixed attribution with another constraint — cautious
  if (constraints.includes("mixed_attribution") && constraints.length >= 2) {
    return "learning_cautious";
  }

  // Any remaining constraint — cautious
  if (constraints.length >= 1) return "learning_cautious";

  // Positive evidence: well-calibrated trust + clean attribution → active
  if (
    (calibrationScore === "well_calibrated" || calibrationScore === "moderately_calibrated") &&
    (trustState === "stable_calibration" || trustState === "improving_calibration") &&
    (
      attributionLabel === "evidence_aligned" ||
      attributionLabel === "regime_supported" ||
      attributionLabel === "catalyst_supported"
    )
  ) {
    return "learning_active";
  }

  // Default — cautious (never active without positive evidence)
  return "learning_cautious";
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(
  label: LearningGovernanceLabel,
  constraints: LearningConstraint[],
  ar: boolean,
): string {
  const primaryConstraint = constraints.length > 0
    ? constraints[0].replace(/_/g, " ")
    : null;

  if (ar) {
    switch (label) {
      case "learning_active":
        return `الحوكمة تتيح التعلم المحكوم؛ إشارات المعايرة متسقة وتسمح بالتحديثات المحكومة.`;
      case "learning_cautious":
        return `التعلم في وضع الحذر المحكوم؛ ${primaryConstraint ? `تقييد نشط: ${primaryConstraint}` : "إشارات مختلطة"} — التحديثات محافظة فقط.`;
      case "learning_paused":
        return `التعلم المحكوم متوقف مؤقتاً؛ قيود المعايرة تمنع التحديثات حتى تتحسن جودة الإشارات.`;
      case "learning_insufficient":
        return `بيانات غير كافية لتقييم جودة التعلم؛ يتطلب مزيداً من نتائج الأطروحات المحلولة.`;
      case "learning_locked":
      default:
        return `التعلم مقفل — جدار الحماية محجوب؛ جميع تحديثات التعلم المحكومة معلّقة.`;
    }
  }
  switch (label) {
    case "learning_active":
      return `Governance permits governed learning; calibration signals are consistent and updates are safe.`;
    case "learning_cautious":
      return `Learning in governed cautious posture; ${primaryConstraint ? `active constraint: ${primaryConstraint}` : "mixed signals"} — updates are conservative only.`;
    case "learning_paused":
      return `Governed learning paused; calibration constraints prevent updates until signal quality improves.`;
    case "learning_insufficient":
      return `Insufficient data to assess learning quality; requires additional resolved thesis outcomes.`;
    case "learning_locked":
    default:
      return `Learning locked — firewall blocked; all governed learning updates suspended.`;
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(
  label: LearningGovernanceLabel,
  constraints: LearningConstraint[],
): string {
  // No injection when insufficient — no meaningful signal to communicate
  if (label === "learning_insufficient") return "";
  const constraintNote = constraints.length > 0
    ? `; ${constraints[0].replace(/_/g, " ")}`
    : "";
  return `Learning governance: ${label.replace(/_/g, " ")}${constraintNote}`.slice(0, 120);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeAdaptiveLearningGovernance(
  input: AdaptiveLearningGovernanceInput,
): AdaptiveLearningGovernanceResult {
  const { ar } = input;

  const constraints = deriveConstraints(input);
  const label = deriveLabel(constraints, input);
  const summary = buildSummary(label, constraints, ar);
  const contextString = buildContextString(label, constraints);

  return {
    label,
    constraints,
    canUpdateLearning: label === "learning_active" || label === "learning_cautious",
    summary,
    contextString,
    isSelfModifying: false,
    isModelRetraining: false,
    isAutonomousEvolution: false,
    firewallBypassed: false,
  };
}
