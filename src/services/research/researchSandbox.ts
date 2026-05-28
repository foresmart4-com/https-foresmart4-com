/**
 * Research Sandbox — Phase 49
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Allows Genesis to explore and compare hypothetical research paths safely.
 * Provides structured comparison across theses, scenarios, frameworks,
 * historical analogs, competing interpretations, and uncertainty sources.
 *
 * Sandbox states:
 *   exploratory          — multiple paths under evaluation; no strong convergence yet
 *   conflicting          — competing frameworks or interpretations with material disagreement
 *   converging           — paths narrowing toward a consistent interpretation
 *   insufficient_research — too little comparative material to evaluate meaningfully
 *   high_uncertainty     — multiple uncertainty flags; evidence thin; scenario spread wide
 *
 * Design rules:
 * - Sandbox never trades, never executes, never overrides governance
 * - Sandbox is exploratory only; no directed action
 * - Uncertainty is acceptable and should be named honestly
 * - Conflict is allowed and must be surfaced without resolution pressure
 * - All outputs are advisory and exploratory only
 * - Research candidates are surfaced only — no automatic ingestion
 * - Context string is compact ≤120 chars; empty for insufficient_research
 *
 * Sandbox→Knowledge interaction:
 *   sandbox may surface researchCandidates (topic flags only)
 *   no candidate enters corpus automatically — all require governance review
 */

import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { GovernanceState } from "@/services/governance/governanceOS";
import type { LearningGovernanceLabel } from "@/services/learning/adaptiveLearningGovernance";
import type { DebateBalance } from "@/services/intelligence/debateEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SandboxState =
  | "exploratory"           // exploring multiple paths; no strong convergence
  | "conflicting"           // competing frameworks / interpretations with material disagreement
  | "converging"            // paths narrowing toward a consistent interpretation
  | "insufficient_research" // too little comparative material to evaluate
  | "high_uncertainty";     // multiple uncertainty flags; thin evidence; wide scenario spread

export type ResearchComparisonType =
  | "thesis_comparison"             // comparing two or more directional theses
  | "scenario_comparison"           // comparing alternative market scenarios
  | "framework_comparison"          // comparing economic schools / analytical frameworks
  | "historical_analog_comparison"  // comparing to documented historical episodes
  | "competing_interpretation"      // reviewing mutually exclusive interpretations of same data
  | "uncertainty_exploration";      // actively mapping uncertainty sources and gaps

export interface ResearchSandboxInput {
  thesisCount: number;                             // active (non-resolved) directional thesis count
  competingTheses: boolean;                        // true when directional opposites active simultaneously
  scenarioSpread: "narrow" | "wide" | "extreme";  // scenario uncertainty spread
  frameworkConflict: boolean;                      // competing economic schools suggest different directions
  historicalAnalogActive: boolean;                 // recognized historical analog is active
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme";
  debateBalance: DebateBalance;
  governanceState: GovernanceState;
  learningGovernance: LearningGovernanceLabel;
  firewallState: FirewallState;
  ar: boolean;
}

export interface ResearchSandboxResult {
  sandboxState: SandboxState;
  activeComparisons: ResearchComparisonType[];  // which comparison types are in scope
  uncertaintyFlags: string[];                    // ≤3 specific uncertainty observations; hedged
  researchCandidates: string[];                  // ≤2 topic flags for governance review; no auto-ingestion
  contextString: string;                         // compact ≤120 chars; "Sandbox:" prefix; empty when insufficient
  // Safety assertions — always enforced, never overrideable
  readonly governanceSafe: true;
  readonly isExploratory: true;
  readonly isExecution: false;
  readonly isTrade: false;
}

// ─── Divergence scoring ───────────────────────────────────────────────────────

function scoreDivergence(input: ResearchSandboxInput): number {
  const {
    competingTheses, frameworkConflict, scenarioSpread,
    uncertaintyLevel, debateBalance, governanceState,
  } = input;
  let score = 0;

  if (competingTheses) score += 2;
  if (frameworkConflict) score += 2;
  if (scenarioSpread === "extreme") score += 3;
  else if (scenarioSpread === "wide") score += 2;
  if (uncertaintyLevel === "extreme") score += 3;
  else if (uncertaintyLevel === "high") score += 2;
  else if (uncertaintyLevel === "moderate") score += 1;
  if (debateBalance === "contested") score += 2;
  else if (debateBalance === "bull_dominant" || debateBalance === "bear_dominant") score += 1;
  if (governanceState === "human_review_priority") score += 3;
  else if (governanceState === "conflict_detected" || governanceState === "elevated_uncertainty") score += 2;
  else if (governanceState === "caution_required") score += 1;

  return Math.min(18, score);
}

// ─── Convergence scoring ──────────────────────────────────────────────────────

function scoreConvergence(input: ResearchSandboxInput): number {
  const {
    historicalAnalogActive, competingTheses, thesisCount,
    scenarioSpread, uncertaintyLevel, debateBalance,
    governanceState,
  } = input;
  let score = 0;

  if (historicalAnalogActive) score += 2;
  if (!competingTheses && thesisCount > 0) score += 2;
  if (scenarioSpread === "narrow") score += 2;
  if (uncertaintyLevel === "low") score += 2;
  else if (uncertaintyLevel === "moderate") score += 1;
  if (debateBalance === "bull_dominant" || debateBalance === "bear_dominant") score += 1;
  if (debateBalance === "inconclusive") score += 1;
  if (governanceState === "coherent") score += 2;

  return Math.min(14, score);
}

// ─── Active comparison types ──────────────────────────────────────────────────

function deriveActiveComparisons(input: ResearchSandboxInput): ResearchComparisonType[] {
  const {
    thesisCount, competingTheses, scenarioSpread,
    frameworkConflict, historicalAnalogActive, uncertaintyLevel,
  } = input;
  const types: ResearchComparisonType[] = [];

  if (thesisCount >= 2 || competingTheses) types.push("thesis_comparison");
  if (scenarioSpread === "wide" || scenarioSpread === "extreme") types.push("scenario_comparison");
  if (frameworkConflict) types.push("framework_comparison");
  if (historicalAnalogActive) types.push("historical_analog_comparison");
  if (competingTheses && frameworkConflict) types.push("competing_interpretation");
  if (uncertaintyLevel === "high" || uncertaintyLevel === "extreme") types.push("uncertainty_exploration");

  return types;
}

// ─── Sandbox state derivation ─────────────────────────────────────────────────

function deriveSandboxState(
  divergence: number,
  convergence: number,
  input: ResearchSandboxInput,
): SandboxState {
  const { thesisCount, historicalAnalogActive, scenarioSpread, uncertaintyLevel, firewallState } = input;

  // Insufficient research: too little material to compare
  if (
    thesisCount === 0 &&
    !historicalAnalogActive &&
    scenarioSpread === "narrow" &&
    uncertaintyLevel === "low"
  ) return "insufficient_research";

  // Firewall blocked with thin material
  if (firewallState === "blocked" && divergence < 3 && convergence < 3) return "insufficient_research";

  // High uncertainty: extreme spread or extreme uncertainty dominates
  if (uncertaintyLevel === "extreme" || (scenarioSpread === "extreme" && divergence >= 6)) {
    return "high_uncertainty";
  }

  // Conflicting: strong divergence with multiple competing signals
  if (divergence >= 7 || (divergence >= 5 && convergence < 3)) return "conflicting";

  // Converging: majority of signals point in one direction
  if (convergence >= 7 && divergence <= 3) return "converging";

  // Exploratory: general comparative exploration
  return "exploratory";
}

// ─── Uncertainty flags ────────────────────────────────────────────────────────

function buildUncertaintyFlags(
  state: SandboxState,
  input: ResearchSandboxInput,
  ar: boolean,
): string[] {
  const flags: string[] = [];
  const {
    competingTheses, frameworkConflict, scenarioSpread,
    uncertaintyLevel, governanceState, learningGovernance,
  } = input;

  if (ar) {
    if (competingTheses)
      flags.push("أطروحات متنافسة نشطة — الاتجاه غير محسوم ويستلزم مقارنة منهجية.");
    if (frameworkConflict)
      flags.push("مدارس اقتصادية متعارضة — لا يمكن لإطار واحد أن يُحسم التحليل.");
    if (scenarioSpread === "extreme" || scenarioSpread === "wide")
      flags.push(`انتشار سيناريوهات ${scenarioSpread === "extreme" ? "حرج" : "واسع"} — التأطير متعدد السيناريوهات أمين أكثر من اتجاه واحد.`);
    if (uncertaintyLevel === "high" || uncertaintyLevel === "extreme")
      flags.push("مستوى عدم يقين مرتفع — الأدلة لا تدعم اليقين العالي حتى الآن.");
    if (governanceState === "elevated_uncertainty" || governanceState === "conflict_detected")
      flags.push("حالة الحوكمة تُشير إلى أن المراجعة البشرية قد تكون مناسبة قبل تصعيد الثقة.");
    if (learningGovernance === "learning_locked" || learningGovernance === "learning_paused")
      flags.push("حوكمة التعلم مُقيَّدة — المعايرة محدودة في الوقت الحالي.");
  } else {
    if (competingTheses)
      flags.push("Competing theses are active — directional view is unresolved; systematic comparison warranted.");
    if (frameworkConflict)
      flags.push("Competing economic schools present — no single framework can settle the analysis.");
    if (scenarioSpread === "extreme" || scenarioSpread === "wide")
      flags.push(`${scenarioSpread === "extreme" ? "Extreme" : "Wide"} scenario spread — multi-scenario framing is more honest than a single directional stance.`);
    if (uncertaintyLevel === "high" || uncertaintyLevel === "extreme")
      flags.push("Elevated uncertainty — evidence does not yet support high-conviction framing.");
    if (governanceState === "elevated_uncertainty" || governanceState === "conflict_detected")
      flags.push("Governance state suggests human review may be appropriate before confidence escalation.");
    if (learningGovernance === "learning_locked" || learningGovernance === "learning_paused")
      flags.push("Learning governance constrained — calibration is limited at this time.");
  }

  // State-level flag
  if (state === "high_uncertainty" && flags.length < 3) {
    flags.push(ar
      ? "صندوق البحث في حالة عدم يقين عالٍ — يُفضَّل استكشاف أطر متعددة قبل الوصول إلى استنتاج."
      : "Sandbox is in high-uncertainty state — exploring multiple frameworks before concluding is preferred.");
  }

  return flags.slice(0, 3);
}

// ─── Research candidates ──────────────────────────────────────────────────────
// Surfaced by sandbox for future governance review only — no automatic ingestion.

function buildResearchCandidates(
  comparisons: ResearchComparisonType[],
  input: ResearchSandboxInput,
  ar: boolean,
): string[] {
  const candidates: string[] = [];
  const { competingTheses, historicalAnalogActive, frameworkConflict, thesisCount } = input;

  if (ar) {
    if (comparisons.includes("thesis_comparison") && competingTheses)
      candidates.push(`مرشح للمراجعة: مقارنة الأطروحات — ${thesisCount} أطروحة نشطة تستدعي التحليل المقارن.`);
    if (comparisons.includes("historical_analog_comparison") && historicalAnalogActive)
      candidates.push("مرشح للمراجعة: النظير التاريخي — نمط محتمل محدد؛ يتطلب مراجعة الحوكمة قبل الإدراج.");
    if (comparisons.includes("framework_comparison") && frameworkConflict)
      candidates.push("مرشح للمراجعة: مقارنة الأطر — تعارض بين المدارس يستحق التوثيق المنهجي.");
  } else {
    if (comparisons.includes("thesis_comparison") && competingTheses)
      candidates.push(`Review candidate: thesis comparison — ${thesisCount} active theses warrant systematic comparison.`);
    if (comparisons.includes("historical_analog_comparison") && historicalAnalogActive)
      candidates.push("Review candidate: historical analog — potential pattern identified; requires governance review before entry.");
    if (comparisons.includes("framework_comparison") && frameworkConflict)
      candidates.push("Review candidate: framework comparison — competing school conflict warrants systematic documentation.");
  }

  return candidates.slice(0, 2);
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  state: SandboxState,
  comparisons: ResearchComparisonType[],
): string {
  if (state === "insufficient_research") return "";
  const compStr = comparisons.length > 0 ? `; ${comparisons[0].replace(/_/g, " ")}` : "";
  return `Sandbox: ${state.replace(/_/g, " ")}${compStr}`.slice(0, 120);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeResearchSandbox(input: ResearchSandboxInput): ResearchSandboxResult {
  const { ar } = input;

  const divergenceScore = scoreDivergence(input);
  const convergenceScore = scoreConvergence(input);
  const sandboxState = deriveSandboxState(divergenceScore, convergenceScore, input);
  const activeComparisons = deriveActiveComparisons(input);
  const uncertaintyFlags = buildUncertaintyFlags(sandboxState, input, ar);
  const researchCandidates = buildResearchCandidates(activeComparisons, input, ar);
  const contextString = buildContextString(sandboxState, activeComparisons);

  return {
    sandboxState,
    activeComparisons,
    uncertaintyFlags,
    researchCandidates,
    contextString,
    governanceSafe: true,
    isExploratory: true,
    isExecution: false,
    isTrade: false,
  };
}
