/**
 * Strategic Approval Intelligence — Phase 36
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates whether Genesis intelligence has risen to a level warranting
 * explicit human strategic awareness or deliberate review.
 *
 * Approval labels:
 *   informational    — insight only; no elevated attention required
 *   monitored        — worth continued observation; no immediate review needed
 *   strategic_review — important thesis requiring deliberate review
 *   high_significance — high-impact intelligence deserving explicit attention
 *   constrained_review — governance or uncertainty constrains escalation
 *
 * Design rules:
 * - Approval is NOT execution: no orders, no broker routing, no trading
 * - Human authority is preserved: Genesis supports, never replaces judgment
 * - Significance elevates only when evidence is coherent and governance is stable
 * - Governance constraints (blocked firewall / locked learning) cap escalation
 * - No urgency inflation: forbidden language enforced in narrative builder
 * - Deterministic: all gates derive from observable signals, no randomness
 *
 * Forbidden output:
 *   "must act now", "execute", "guaranteed", "immediate trade",
 *   "certain outcome", "definitive", "buy/sell now"
 */

import type { WorkflowState } from "@/services/governance/approvalWorkflow";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { CredibilityLabel } from "@/services/credibility/credibilityEngine";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { AttributionLabel } from "@/services/learning/outcomeAttribution";
import type { LearningGovernanceLabel } from "@/services/learning/adaptiveLearningGovernance";
import type { EventSignificance } from "@/services/macro/macroEventEngine";
import type { PortfolioRiskLabel } from "@/services/portfolio/portfolioRiskEngine";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StrategicApprovalLabel =
  | "informational"     // insight only; no elevated review required
  | "monitored"         // worth continued observation; no immediate review
  | "strategic_review"  // deliberate human review recommended
  | "high_significance" // high-impact; explicit human attention appropriate
  | "constrained_review"; // governance constraints limit escalation

export interface StrategicApprovalInput {
  workflowState: WorkflowState;           // Phase-35: escalation tier
  firewallState: FirewallState;           // Phase-30: governance gate
  credibilityLabel: CredibilityLabel;     // Phase-34: source quality
  hasMaterialDisagreement: boolean;       // Phase-32: debate conflict
  debateBalance: DebateBalance;           // Phase-32: directional balance
  trustState: TrustState;                 // Phase-25: calibration trend
  calibrationScore: CalibrationScore;     // Phase-24: ECE-based quality
  attributionLabel: AttributionLabel;     // Phase-37: outcome explanation
  learningGovernance: LearningGovernanceLabel; // Phase-38: learning gate
  macroSignificance: EventSignificance;   // Phase-33: macro relevance
  hasActiveVulnerability: boolean;        // Phase-27: portfolio stress
  riskLabel: PortfolioRiskLabel;          // Phase-27: portfolio risk type
  strategicBias: StrategicBias;           // Phase-22: strategic posture
  hasConflict: boolean;                   // Phase-22: inter-signal conflict
  regime: string;                         // current market regime label
  ar: boolean;
}

export interface StrategicApprovalResult {
  approval: StrategicApprovalLabel;
  significanceScore: number;           // internal 0–24 score (not rendered directly)
  humanReviewJustified: boolean;       // true for strategic_review and high_significance
  elevatedBy: string[];                // signals that justified significance elevation
  constrainedBy: string[];             // signals that limited or capped significance
  narrative: string;                   // 1-2 sentences, hedged language only
  contextString: string;               // compact ≤130 chars; empty for informational/monitored
  // Safety assertions — always false; present for audit
  readonly isExecution: false;
  readonly isTradeRecommendation: false;
  readonly isAutonomousAction: false;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

interface ScoreAccumulator {
  points: number;
  elevatedBy: string[];
  constrainedBy: string[];
}

function scoreSignals(input: StrategicApprovalInput): ScoreAccumulator {
  const {
    workflowState, firewallState, credibilityLabel, hasMaterialDisagreement,
    debateBalance, trustState, calibrationScore, attributionLabel,
    learningGovernance, macroSignificance, hasActiveVulnerability,
    riskLabel, strategicBias, hasConflict, regime,
  } = input;

  let points = 0;
  const elevatedBy: string[] = [];
  const constrainedBy: string[] = [];

  // ── Workflow escalation (primary gate) ────────────────────────────────────
  if (workflowState === "approval_required") {
    points += 6; elevatedBy.push("approval workflow");
  } else if (workflowState === "monitored_thesis") {
    points += 3; elevatedBy.push("monitored thesis");
  } else if (workflowState === "research_item") {
    points += 1; elevatedBy.push("research item");
  }
  // observation / insufficient_quality: 0 pts — intentionally no elevation

  // ── Firewall state ────────────────────────────────────────────────────────
  if (firewallState === "cleared") {
    points += 2; elevatedBy.push("firewall cleared");
  } else if (firewallState === "caution") {
    points += 1;
  } else if (firewallState === "constrained") {
    points -= 1; constrainedBy.push("firewall constrained");
  }
  // blocked handled separately as a hard gate

  // ── Credibility ───────────────────────────────────────────────────────────
  if (credibilityLabel === "high_credibility") {
    points += 2; elevatedBy.push("high credibility");
  } else if (credibilityLabel === "medium_credibility") {
    points += 1;
  } else if (credibilityLabel === "low_credibility") {
    points -= 2; constrainedBy.push("low credibility");
  }
  // uncertain_credibility: 0 pts

  // ── Debate / disagreement ─────────────────────────────────────────────────
  if (hasMaterialDisagreement) {
    points -= 2; constrainedBy.push("material disagreement");
  } else if (debateBalance === "bull_dominant" || debateBalance === "bear_dominant") {
    points += 1; elevatedBy.push("clear directional balance");
  } else if (debateBalance === "contested") {
    points -= 1; constrainedBy.push("contested debate");
  }

  // ── Trust / calibration ───────────────────────────────────────────────────
  if (trustState === "stable_calibration" || trustState === "improving_calibration") {
    points += 2; elevatedBy.push("stable trust");
  } else if (trustState === "fragile_calibration") {
    points -= 2; constrainedBy.push("fragile calibration");
  } else if (trustState === "insufficient_evidence") {
    points -= 1; constrainedBy.push("insufficient evidence");
  }

  if (calibrationScore === "well_calibrated") {
    points += 2; elevatedBy.push("well calibrated");
  } else if (calibrationScore === "moderately_calibrated") {
    points += 1;
  } else if (calibrationScore === "weakly_calibrated") {
    points -= 2; constrainedBy.push("weak calibration");
  } else {
    // insufficient_data
    points -= 1;
  }

  // ── Attribution ───────────────────────────────────────────────────────────
  if (attributionLabel === "evidence_aligned") {
    points += 2; elevatedBy.push("evidence aligned");
  } else if (attributionLabel === "regime_supported" || attributionLabel === "catalyst_supported") {
    points += 1;
  } else if (attributionLabel === "luck_or_noise") {
    points -= 2; constrainedBy.push("luck or noise pattern");
  } else if (attributionLabel === "attribution_unclear") {
    points -= 1; constrainedBy.push("attribution unclear");
  }

  // ── Learning governance ───────────────────────────────────────────────────
  if (learningGovernance === "learning_active") {
    points += 1; elevatedBy.push("learning active");
  } else if (learningGovernance === "learning_paused") {
    points -= 1; constrainedBy.push("learning paused");
  }
  // learning_cautious / learning_insufficient: 0 pts
  // learning_locked handled separately as a hard gate

  // ── Macro significance ────────────────────────────────────────────────────
  if (macroSignificance === "critical") {
    points += 2; elevatedBy.push("critical macro event");
  } else if (macroSignificance === "meaningful") {
    points += 1; elevatedBy.push("meaningful macro event");
  }

  // ── Portfolio relevance ───────────────────────────────────────────────────
  if (hasActiveVulnerability) {
    points += 1; elevatedBy.push("portfolio vulnerability");
  }
  if (riskLabel === "macro_vulnerable" || riskLabel === "growth_sensitive") {
    points += 1; elevatedBy.push("elevated portfolio risk");
  }

  // ── Strategic bias + conflict ─────────────────────────────────────────────
  if (strategicBias === "constructive" || strategicBias === "opportunistic") {
    points += 1; elevatedBy.push("constructive strategic bias");
  } else if (strategicBias === "uncertain") {
    points -= 1; constrainedBy.push("uncertain strategic bias");
  }
  if (hasConflict) {
    points -= 1; constrainedBy.push("inter-signal conflict");
  }

  // ── Regime clarity ────────────────────────────────────────────────────────
  if (regime.trim().length > 3) {
    points += 1;
  }

  return { points, elevatedBy, constrainedBy };
}

// ─── Label derivation ─────────────────────────────────────────────────────────

function deriveLabel(
  score: ScoreAccumulator,
  input: StrategicApprovalInput,
): StrategicApprovalLabel {
  const { workflowState, firewallState, learningGovernance } = input;
  const { points } = score;

  // Hard governance gate: blocked firewall or locked learning caps any escalation
  const isGovernanceBlocked =
    firewallState === "blocked" || learningGovernance === "learning_locked";

  // Only activate constrained_review if there was something meaningful to constrain
  if (isGovernanceBlocked) {
    const wouldEscalate =
      workflowState === "approval_required" ||
      (workflowState === "monitored_thesis" && points >= 6);
    if (wouldEscalate) return "constrained_review";
    return "informational";
  }

  // Informational floor: observation / insufficient_quality workflow states with no signal
  if (workflowState === "observation" || workflowState === "insufficient_quality") {
    return "informational";
  }

  // Derive by workflow tier × quality score
  if (workflowState === "approval_required") {
    if (points >= 15) return "high_significance";
    if (points >= 8)  return "strategic_review";
    if (points >= 4)  return "monitored";
    return "informational";
  }

  if (workflowState === "monitored_thesis") {
    if (points >= 11) return "strategic_review";
    if (points >= 5)  return "monitored";
    return "informational";
  }

  if (workflowState === "research_item") {
    if (points >= 5) return "monitored";
    return "informational";
  }

  return "informational";
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  label: StrategicApprovalLabel,
  elevatedBy: string[],
  constrainedBy: string[],
  ar: boolean,
): string {
  const topElevated = elevatedBy[0] ?? null;
  const topConstrained = constrainedBy[0] ?? null;

  if (ar) {
    switch (label) {
      case "high_significance":
        return `استخبارات استراتيجية ذات أهمية عالية${topElevated ? ` — مدعومة بـ ${topElevated.replace(/_/g, " ")}` : ""}. الاهتمام البشري الصريح مناسب للمراجعة.`;
      case "strategic_review":
        return `المراجعة الاستراتيجية مبررة${topElevated ? ` بـ ${topElevated.replace(/_/g, " ")}` : ""}. الحكم البشري الدقيق موصى به — لا تنفيذ تلقائي.`;
      case "constrained_review":
        return `المراجعة مرغوبة لكن${topConstrained ? ` ${topConstrained.replace(/_/g, " ")} يُقيّد التصعيد` : "قيود الحوكمة تُحدّ التصعيد"}. احتفظ بوعي بشري إضافي.`;
      case "monitored":
        return `الإشارة تستحق المتابعة المستمرة${topElevated ? ` (${topElevated.replace(/_/g, " ")})` : ""}. لا توجد حاجة لمراجعة استراتيجية فورية.`;
      case "informational":
      default:
        return `الاستخبارات إعلامية فقط. لا توجد إشارات تستوجب الاهتمام الاستراتيجي المرتفع في الوقت الحالي.`;
    }
  }
  switch (label) {
    case "high_significance":
      return `High-significance strategic intelligence${topElevated ? ` — supported by ${topElevated}` : ""}. Explicit human attention is appropriate for review.`;
    case "strategic_review":
      return `Strategic review is justified${topElevated ? ` by ${topElevated}` : ""}. Deliberate human judgment is recommended — no autonomous action.`;
    case "constrained_review":
      return `Review would be warranted but${topConstrained ? ` ${topConstrained} constrains escalation` : " governance constraints limit escalation"}. Maintain heightened human awareness.`;
    case "monitored":
      return `Signal warrants continued observation${topElevated ? ` (${topElevated})` : ""}. No immediate strategic review required.`;
    case "informational":
    default:
      return `Intelligence is informational only. No signals warrant elevated strategic attention at this time.`;
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(
  label: StrategicApprovalLabel,
  elevatedBy: string[],
  constrainedBy: string[],
): string {
  // No injection for routine levels — avoids context bloat
  if (label === "informational" || label === "monitored") return "";

  if (label === "high_significance") {
    const driver = elevatedBy[0] ? `; ${elevatedBy[0]}` : "";
    return `Strategic significance: high significance; human attention appropriate${driver}`.slice(0, 130);
  }
  if (label === "strategic_review") {
    const driver = elevatedBy[0] ? `; ${elevatedBy[0]}` : "";
    return `Strategic significance: strategic review; human review recommended${driver}`.slice(0, 130);
  }
  if (label === "constrained_review") {
    const limiter = constrainedBy[0] ? `; ${constrainedBy[0]}` : "";
    return `Strategic significance: constrained review; governance limits escalation${limiter}`.slice(0, 130);
  }
  return "";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeStrategicApproval(
  input: StrategicApprovalInput,
): StrategicApprovalResult {
  const { ar } = input;

  const scored = scoreSignals(input);
  const label = deriveLabel(scored, input);
  const { elevatedBy, constrainedBy } = scored;
  const narrative = buildNarrative(label, elevatedBy, constrainedBy, ar);
  const contextString = buildContextString(label, elevatedBy, constrainedBy);

  return {
    approval: label,
    significanceScore: scored.points,
    humanReviewJustified: label === "strategic_review" || label === "high_significance",
    elevatedBy,
    constrainedBy,
    narrative,
    contextString,
    isExecution: false,
    isTradeRecommendation: false,
    isAutonomousAction: false,
  };
}
