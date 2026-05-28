/**
 * Governance Operating System — Phase 47
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Supervises and coordinates all Genesis intelligence layers by detecting
 * cross-layer conflicts, enforcing confidence discipline, and flagging
 * when institutional hygiene requires explicit uncertainty acknowledgment
 * or human review.
 *
 * Governance states:
 *   coherent              — layers broadly agree; discipline maintained; no major flags
 *   caution_required      — some layer disagreement or thin evidence; moderate discipline needed
 *   conflict_detected     — material cross-layer conflict; must be surfaced honestly
 *   elevated_uncertainty  — multiple uncertainty signals; wide scenario spread; limited evidence
 *   human_review_priority — critical cross-layer tension or governance failure; human attention needed
 *
 * Governance responsibilities:
 *   1. Reasoning consistency — detect agreement, contradiction, unresolved conflict
 *   2. Confidence discipline — prevent unsupported escalation, narrative certainty
 *   3. Conflict arbitration  — identify specific cross-layer tensions
 *   4. Institutional hygiene — encourage competing views, explicit uncertainty, human review
 *
 * Design rules:
 * - Governance supervises; it does not override live data
 * - Governance never trades, never executes, never forces conclusions
 * - Uncertainty is acceptable and should be named, not suppressed
 * - Conflict is allowed and must be surfaced honestly
 * - All outputs are advisory and supervisory only
 * - Confidence modifier is bounded (-5 to +2); never applied without explicit context line
 */

import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { WorkflowState } from "@/services/governance/approvalWorkflow";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { ThesisLabState } from "@/services/intelligence/thesisLab";
import type { ScenarioLabel } from "@/services/intelligence/scenarioIntelligence";
import type { MacroCycleState } from "@/services/macro/globalMacroMemory";
import type { BehavioralLabel } from "@/services/intelligence/behavioralMarket";
import type { PortfolioConstructionLabel } from "@/services/portfolio/portfolioConstruction";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";
import type { MarketOrchestratorState } from "@/services/intelligence/marketOrchestrator";
import type { AttributionLabel } from "@/services/learning/outcomeAttribution";
import type { LearningGovernanceLabel } from "@/services/learning/adaptiveLearningGovernance";
import type { StrategicApprovalLabel } from "@/services/intelligence/strategicApproval";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GovernanceState =
  | "coherent"              // layers agree; no discipline flags
  | "caution_required"      // moderate disagreement or thin evidence
  | "conflict_detected"     // material cross-layer conflict
  | "elevated_uncertainty"  // wide uncertainty; limited evidence support
  | "human_review_priority";// critical tension; human attention required

export type GovernanceConflict =
  | "macro_behavioral_divergence"      // macro regime vs behavioral sentiment contradict
  | "thesis_market_disagreement"       // thesis appears supported but market structure unstable
  | "portfolio_regime_mismatch"        // portfolio concentration + tightening cycle
  | "scenario_debate_conflict"         // scenario direction contradicts debate evidence
  | "strategic_governance_tension"     // strategic approval elevated while governance blocks
  | "evidence_confidence_mismatch"     // escalation without calibration quality to support it
  | "behavioral_cross_market_diverge"; // behavioral sentiment contradicts cross-market regime

export interface GovernanceOSInput {
  firewallState: FirewallState;
  workflowState: WorkflowState;
  trustState: TrustState;
  calibrationScore: CalibrationScore;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  strategicBias: StrategicBias;
  hasStrategicConflict: boolean;
  thesisState: ThesisLabState;
  dominantScenario: ScenarioLabel;
  scenarioUncertaintyLevel: "low" | "moderate" | "high" | "extreme";
  scenarioProbability: "favored" | "contested" | "uncertain" | "insufficient";
  macroCycle: MacroCycleState;
  behavioralLabel: BehavioralLabel;
  portfolioConstructionLabel: PortfolioConstructionLabel;
  portfolioRequiresHumanReview: boolean;
  crossMarketLabel: CrossMarketRegimeLabel;
  orchestratorState: MarketOrchestratorState;
  attributionLabel: AttributionLabel;
  learningGovernance: LearningGovernanceLabel;
  strategicApproval: StrategicApprovalLabel;
  hasActiveVulnerability: boolean;
  macroSignificanceCritical: boolean;
  ar: boolean;
}

export interface GovernanceOSResult {
  governanceState: GovernanceState;
  governanceNotes: string[];            // up to 4 advisory notes, hedged language
  activeConflicts: GovernanceConflict[];
  requiresHumanReview: boolean;
  confidenceModifier: number;           // -5 to +2; applied only when in context
  contextString: string;                // compact ≤130 chars; empty for coherent
  // Safety assertions
  readonly isSupervisory: true;         // governance supervises only
  readonly isAdvisoryOnly: true;        // never overrides; never executes
  readonly isExecution: false;          // no trade logic
}

// ─── Coherence scoring ────────────────────────────────────────────────────────

function scoreCoherence(input: GovernanceOSInput): number {
  const {
    firewallState, calibrationScore, trustState, hasMaterialDisagreement,
    hasStrategicConflict, thesisState, scenarioProbability, macroCycle,
    behavioralLabel, crossMarketLabel, orchestratorState,
  } = input;
  let score = 0;

  if (firewallState === "cleared") score += 2;
  if (calibrationScore === "well_calibrated") score += 2;
  if (trustState === "stable_calibration" || trustState === "improving_calibration") score += 2;
  if (!hasMaterialDisagreement) score += 2;
  if (!hasStrategicConflict) score += 1;
  if (thesisState === "supported_thesis" || thesisState === "monitored_thesis") score += 1;
  if (scenarioProbability === "favored") score += 1;
  if (macroCycle === "stable_cycle") score += 1;
  if (behavioralLabel === "balanced_behavior") score += 1;
  if (crossMarketLabel === "aligned_regime" || crossMarketLabel === "partially_aligned") score += 1;
  if (orchestratorState === "coordinated_market") score += 1;

  return Math.min(20, score);
}

// ─── Conflict detection ───────────────────────────────────────────────────────

function detectConflicts(input: GovernanceOSInput): { conflicts: GovernanceConflict[]; score: number } {
  const {
    macroCycle, behavioralLabel, thesisState, orchestratorState,
    portfolioConstructionLabel, dominantScenario, debateBalance,
    strategicApproval, firewallState, learningGovernance,
    calibrationScore, attributionLabel, crossMarketLabel,
    scenarioProbability,
  } = input;

  const conflicts: GovernanceConflict[] = [];
  let score = 0;

  // ── Macro vs behavioral divergence ───────────────────────────────────────
  // Macro says stable/easing but behavioral says fear — or vice versa
  const macroOptimistic = macroCycle === "stable_cycle" || macroCycle === "easing_cycle";
  const macroStressed = macroCycle === "tightening_cycle";
  if (macroOptimistic && behavioralLabel === "fear_dominant") {
    conflicts.push("macro_behavioral_divergence"); score += 2;
  } else if (macroStressed && behavioralLabel === "greed_dominant") {
    conflicts.push("macro_behavioral_divergence"); score += 2;
  }

  // ── Thesis vs market disagreement ─────────────────────────────────────────
  if (
    thesisState === "supported_thesis" &&
    (orchestratorState === "unstable_market" || orchestratorState === "fragmented_market")
  ) {
    conflicts.push("thesis_market_disagreement"); score += 2;
  }

  // ── Portfolio vs regime mismatch ──────────────────────────────────────────
  if (
    (portfolioConstructionLabel === "concentrated_portfolio" ||
      portfolioConstructionLabel === "correlation_risk") &&
    macroCycle === "tightening_cycle"
  ) {
    conflicts.push("portfolio_regime_mismatch"); score += 2;
  }

  // ── Scenario vs debate conflict ────────────────────────────────────────────
  const scenarioBullish = dominantScenario === "bullish_scenario";
  const scenarioBearish = dominantScenario === "bearish_scenario";
  if (
    (scenarioBullish && debateBalance === "bear_dominant") ||
    (scenarioBearish && debateBalance === "bull_dominant")
  ) {
    conflicts.push("scenario_debate_conflict"); score += 2;
  }

  // ── Strategic vs governance tension ───────────────────────────────────────
  // Strategic approval elevated but firewall or learning blocked
  const approvalElevated = strategicApproval === "high_significance" || strategicApproval === "strategic_review";
  if (approvalElevated && firewallState === "blocked") {
    conflicts.push("strategic_governance_tension"); score += 3;
  } else if (approvalElevated && learningGovernance === "learning_locked") {
    // Don't double-count — add only if not already flagged
    if (!conflicts.includes("strategic_governance_tension")) {
      conflicts.push("strategic_governance_tension"); score += 2;
    }
  }

  // ── Evidence vs confidence mismatch ───────────────────────────────────────
  // Escalation without calibration evidence
  if (
    (calibrationScore === "weakly_calibrated" || calibrationScore === "insufficient_data") &&
    approvalElevated
  ) {
    conflicts.push("evidence_confidence_mismatch"); score += 3;
  } else if (
    (attributionLabel === "attribution_unclear" || attributionLabel === "luck_or_noise") &&
    thesisState === "supported_thesis"
  ) {
    if (!conflicts.includes("evidence_confidence_mismatch")) {
      conflicts.push("evidence_confidence_mismatch"); score += 2;
    }
  }

  // ── Behavioral vs cross-market divergence ─────────────────────────────────
  if (
    behavioralLabel === "greed_dominant" &&
    (crossMarketLabel === "conflicting_regime" || crossMarketLabel === "regime_divergence")
  ) {
    conflicts.push("behavioral_cross_market_diverge"); score += 2;
  } else if (
    behavioralLabel === "fear_dominant" &&
    crossMarketLabel === "aligned_regime" &&
    scenarioProbability === "favored" &&
    !["bearish_scenario", "stress_scenario", "uncertainty_scenario"].includes(dominantScenario)
  ) {
    conflicts.push("behavioral_cross_market_diverge"); score += 1;
  }

  // Additional severity: firewall blocked adds base pressure
  if (firewallState === "blocked") score += 1;
  // Multiple simultaneous uncertainty sources
  if (macroCycle === "uncertain_cycle" && thesisState === "competing_theses") score += 1;

  return { conflicts, score: Math.min(20, score) };
}

// ─── Governance state derivation ─────────────────────────────────────────────

function deriveGovernanceState(
  coherenceScore: number,
  conflictResult: { conflicts: GovernanceConflict[]; score: number },
  input: GovernanceOSInput,
): GovernanceState {
  const { score: cs, conflicts } = conflictResult;
  const {
    firewallState, scenarioUncertaintyLevel, calibrationScore,
    thesisState, macroCycle, portfolioRequiresHumanReview,
    strategicApproval,
  } = input;

  // Human review priority: critical cross-layer tension
  if (
    cs >= 8 ||
    (firewallState === "blocked" &&
      (strategicApproval === "high_significance" || strategicApproval === "strategic_review")) ||
    (conflicts.includes("evidence_confidence_mismatch") && conflicts.includes("strategic_governance_tension")) ||
    portfolioRequiresHumanReview && cs >= 4
  ) return "human_review_priority";

  // Conflict detected: material cross-layer conflict
  if (cs >= 5 || conflicts.length >= 3) return "conflict_detected";

  // Elevated uncertainty: multiple uncertainty signals
  if (
    scenarioUncertaintyLevel === "extreme" ||
    (calibrationScore === "insufficient_data" && cs >= 2) ||
    (thesisState === "competing_theses" && macroCycle === "uncertain_cycle") ||
    (cs >= 3 && coherenceScore < 5)
  ) return "elevated_uncertainty";

  // Caution required: moderate disagreement or thin evidence
  if (cs >= 2 || coherenceScore < 7) return "caution_required";

  // Coherent: no major flags
  return "coherent";
}

// ─── Governance notes ─────────────────────────────────────────────────────────

function buildNotes(
  state: GovernanceState,
  conflicts: GovernanceConflict[],
  input: GovernanceOSInput,
  ar: boolean,
): string[] {
  const notes: string[] = [];

  const NOTE_EN: Partial<Record<GovernanceConflict, string>> = {
    macro_behavioral_divergence:
      "Macro cycle and behavioral sentiment diverge; confidence discipline recommended.",
    thesis_market_disagreement:
      "Thesis appears supported but market structure is unstable; competing view warrants acknowledgment.",
    portfolio_regime_mismatch:
      "Portfolio concentration + tightening macro cycle may compound risk exposure.",
    scenario_debate_conflict:
      "Dominant scenario contradicts debate evidence direction; balanced framing appropriate.",
    strategic_governance_tension:
      "Strategic significance elevated while governance constraints are active; escalation requires caution.",
    evidence_confidence_mismatch:
      "Calibration evidence is thin; confidence escalation lacks sufficient structural support.",
    behavioral_cross_market_diverge:
      "Behavioral sentiment and cross-market regime diverge; verify signal direction before framing.",
  };

  const NOTE_AR: Partial<Record<GovernanceConflict, string>> = {
    macro_behavioral_divergence:
      "الدورة الكلية والمشاعر السلوكية متباعدة؛ انضباط الثقة موصى به.",
    thesis_market_disagreement:
      "الأطروحة تبدو مدعومة لكن البنية السوقية غير مستقرة؛ الرأي المعارض يستحق الإقرار.",
    portfolio_regime_mismatch:
      "تركيز المحفظة + دورة تشديد كلية قد يُضاعف التعرض للمخاطر.",
    scenario_debate_conflict:
      "السيناريو السائد يتعارض مع اتجاه أدلة النقاش؛ التأطير المتوازن مناسب.",
    strategic_governance_tension:
      "الأهمية الاستراتيجية مرتفعة مع قيود حوكمة نشطة؛ التصعيد يتطلب حذراً.",
    evidence_confidence_mismatch:
      "أدلة المعايرة رقيقة؛ تصعيد الثقة يفتقر إلى دعم هيكلي كافٍ.",
    behavioral_cross_market_diverge:
      "المشاعر السلوكية والنظام العابر للأسواق متباعدان؛ تحقق من اتجاه الإشارة.",
  };

  for (const conflict of conflicts.slice(0, 3)) {
    const note = ar ? NOTE_AR[conflict] : NOTE_EN[conflict];
    if (note) notes.push(note);
  }

  // State-level notes
  if (state === "human_review_priority" && notes.length < 4) {
    notes.push(ar
      ? "مراجعة بشرية ذات أولوية — التوترات متعددة الطبقات تتجاوز ما يمكن حله بالاستدلال الآلي وحده."
      : "Human review is priority — multi-layer tensions exceed what automated reasoning can resolve alone.");
  }
  if (state === "elevated_uncertainty" && notes.length < 4) {
    notes.push(ar
      ? "عدم اليقين مرتفع؛ التأطير متعدد السيناريوهات أمين أكثر من توجه اتجاهي واحد."
      : "Uncertainty is elevated; multi-scenario framing is more honest than a single directional stance.");
  }

  return notes.slice(0, 4);
}

// ─── Confidence modifier ──────────────────────────────────────────────────────

function deriveConfidenceModifier(state: GovernanceState): number {
  switch (state) {
    case "coherent":              return 0;
    case "caution_required":      return -1;
    case "conflict_detected":     return -2;
    case "elevated_uncertainty":  return -3;
    case "human_review_priority": return -4;
  }
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  state: GovernanceState,
  conflicts: GovernanceConflict[],
  modifier: number,
): string {
  if (state === "coherent") return "";
  const topConflict = conflicts[0]?.replace(/_/g, " ") ?? "";
  const modStr = modifier !== 0 ? `; confidence ${modifier} pts` : "";
  const conflictStr = topConflict ? `; ${topConflict}` : "";
  return `Governance: ${state.replace(/_/g, " ")}${conflictStr}${modStr}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeGovernanceOS(input: GovernanceOSInput): GovernanceOSResult {
  const { ar } = input;

  const coherenceScore = scoreCoherence(input);
  const conflictResult = detectConflicts(input);
  const governanceState = deriveGovernanceState(coherenceScore, conflictResult, input);
  const governanceNotes = buildNotes(governanceState, conflictResult.conflicts, input, ar);
  const confidenceModifier = deriveConfidenceModifier(governanceState);
  const contextString = buildContextString(
    governanceState, conflictResult.conflicts, confidenceModifier,
  );

  return {
    governanceState,
    governanceNotes,
    activeConflicts: conflictResult.conflicts,
    requiresHumanReview: governanceState === "human_review_priority",
    confidenceModifier,
    contextString,
    isSupervisory: true,
    isAdvisoryOnly: true,
    isExecution: false,
  };
}
