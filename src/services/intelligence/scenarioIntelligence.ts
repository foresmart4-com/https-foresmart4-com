/**
 * Scenario Intelligence — Phase 46
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates alternative market futures by weighing macro, regime, cross-market,
 * portfolio, and thesis signals. Identifies the dominant scenario and its
 * opposing case without asserting deterministic prediction.
 *
 * Scenario labels:
 *   bullish_scenario      — macro, regime, cross-market support constructive outcome
 *   bearish_scenario      — macro, regime, stress signals support defensive/downside
 *   neutral_scenario      — balanced signals; no dominant directional scenario
 *   rotational_scenario   — regime rotation implies leadership shift, not direction
 *   stress_scenario       — elevated stress + volatility + defensive signals dominate
 *   uncertainty_scenario  — conflicting signals prevent scenario identification
 *
 * Thesis + Scenario interaction:
 *   competing_theses     → adds weight to uncertainty_scenario; opposing always set
 *   fragile_thesis       → degrades bullish scenario weight; elevates stress/uncertainty
 *   invalidated_thesis   → favors uncertainty_scenario
 *   supported_thesis     → amplifies dominant scenario alignment
 *
 * Design rules:
 * - No deterministic prediction: scenarios describe probability pressure, not outcomes
 * - No market prophecy: "favored", "contested", "uncertain" — never "will happen"
 * - Honest default: uncertainty_scenario when evidence is insufficient
 * - No execution logic: scenario framing is advisory and educational only
 */

import type { MarketRegime, StressLevel } from "@/services/market/marketIntelEngine";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { EventSignificance } from "@/services/macro/macroEventEngine";
import type { PortfolioRiskLabel } from "@/services/portfolio/portfolioRiskEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";
import type { MarketOrchestratorState } from "@/services/intelligence/marketOrchestrator";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";
import type { ThesisLabState } from "@/services/intelligence/thesisLab";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScenarioLabel =
  | "bullish_scenario"      // constructive macro/regime evidence
  | "bearish_scenario"      // defensive/downside macro evidence
  | "neutral_scenario"      // balanced; no dominant scenario
  | "rotational_scenario"   // structural leadership shift in progress
  | "stress_scenario"       // elevated stress; volatility; defensive signals dominant
  | "uncertainty_scenario"; // conflicting evidence; scenario identification prevented

export interface ScenarioIntelligenceInput {
  marketRegime: MarketRegime;
  riskOnScore: number;                        // -100..+100
  stressLevel: StressLevel;
  stressScore: number;                        // 0-100
  breadthBullPct: number;                     // 0-100
  strategicBias: StrategicBias;
  hasStrategicConflict: boolean;
  firewallState: FirewallState;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  macroSignificance: EventSignificance;
  portfolioRiskLabel: PortfolioRiskLabel;
  hasActiveVulnerability: boolean;
  orchestratorState: MarketOrchestratorState;
  crossMarketLabel: CrossMarketRegimeLabel;
  thesisState: ThesisLabState;
  calibrationScore: CalibrationScore;
  trustState: TrustState;
  ar: boolean;
}

export interface ScenarioIntelligenceResult {
  dominantScenario: ScenarioLabel;
  opposingScenario: ScenarioLabel | null;
  scenarioConfidencePressure: number;   // -5 to +3 pts additive to AI confidence anchor
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme";
  scenarioProbability: "favored" | "contested" | "uncertain" | "insufficient";
  narrative: string;                    // 1-2 sentences, hedged language
  contextString: string;                // compact ≤130 chars; empty when insufficient
  hasStressSignal: boolean;             // true for stress_scenario / high uncertainty
}

// ─── Scenario scoring ─────────────────────────────────────────────────────────

type ScenarioScores = Record<ScenarioLabel, number>;

function scoreScenarios(input: ScenarioIntelligenceInput): ScenarioScores {
  const {
    marketRegime, riskOnScore, stressLevel, stressScore, breadthBullPct,
    strategicBias, hasStrategicConflict, firewallState, hasMaterialDisagreement,
    debateBalance, macroSignificance, portfolioRiskLabel, hasActiveVulnerability,
    orchestratorState, crossMarketLabel, thesisState, calibrationScore, trustState,
  } = input;

  const scores: ScenarioScores = {
    bullish_scenario: 0,
    bearish_scenario: 0,
    neutral_scenario: 0,
    rotational_scenario: 0,
    stress_scenario: 0,
    uncertainty_scenario: 0,
  };

  // ── Bullish ───────────────────────────────────────────────────────────────
  if (riskOnScore >= 50) scores.bullish_scenario += 20;
  else if (riskOnScore >= 30) scores.bullish_scenario += 12;
  if (marketRegime === "risk_on") scores.bullish_scenario += 15;
  if (strategicBias === "constructive") scores.bullish_scenario += 10;
  if (breadthBullPct >= 65) scores.bullish_scenario += 8;
  if (debateBalance === "bull_dominant") scores.bullish_scenario += 6;
  if (crossMarketLabel === "aligned_regime" && riskOnScore > 0) scores.bullish_scenario += 5;
  if (orchestratorState === "coordinated_market") scores.bullish_scenario += 4;

  // ── Bearish ───────────────────────────────────────────────────────────────
  if (riskOnScore <= -40) scores.bearish_scenario += 20;
  else if (riskOnScore <= -20) scores.bearish_scenario += 12;
  if (marketRegime === "risk_off") scores.bearish_scenario += 15;
  if (strategicBias === "defensive") scores.bearish_scenario += 10;
  if (breadthBullPct <= 35) scores.bearish_scenario += 8;
  if (debateBalance === "bear_dominant") scores.bearish_scenario += 6;
  if (stressLevel === "elevated") scores.bearish_scenario += 5;
  if (hasActiveVulnerability) scores.bearish_scenario += 4;

  // ── Stress ────────────────────────────────────────────────────────────────
  if (stressLevel === "high") scores.stress_scenario += 28;
  else if (stressLevel === "elevated") scores.stress_scenario += 14;
  if (firewallState === "blocked") scores.stress_scenario += 12;
  if (stressScore >= 70) scores.stress_scenario += 10;
  if (macroSignificance === "critical") scores.stress_scenario += 8;
  if (hasActiveVulnerability && stressLevel !== "low") scores.stress_scenario += 5;
  if (portfolioRiskLabel === "macro_vulnerable") scores.stress_scenario += 5;
  if (orchestratorState === "unstable_market") scores.stress_scenario += 5;

  // ── Rotational ────────────────────────────────────────────────────────────
  if (orchestratorState === "regime_rotation") scores.rotational_scenario += 28;
  if (crossMarketLabel === "regime_divergence") scores.rotational_scenario += 12;
  if (orchestratorState === "transition_market") scores.rotational_scenario += 10;
  if (marketRegime === "volatile") scores.rotational_scenario += 5;

  // ── Neutral ───────────────────────────────────────────────────────────────
  if (Math.abs(riskOnScore) < 20) scores.neutral_scenario += 18;
  if (marketRegime === "neutral") scores.neutral_scenario += 14;
  if (marketRegime === "mixed") scores.neutral_scenario += 10;
  if (stressLevel === "low" && Math.abs(riskOnScore) < 25) scores.neutral_scenario += 6;
  if (debateBalance === "inconclusive") scores.neutral_scenario += 5;

  // ── Uncertainty ───────────────────────────────────────────────────────────
  if (hasMaterialDisagreement) scores.uncertainty_scenario += 16;
  if (hasStrategicConflict) scores.uncertainty_scenario += 14;
  if (crossMarketLabel === "conflicting_regime") scores.uncertainty_scenario += 12;
  if (calibrationScore === "insufficient_data") scores.uncertainty_scenario += 10;
  if (firewallState === "blocked") scores.uncertainty_scenario += 8;
  if (trustState === "fragile_calibration") scores.uncertainty_scenario += 6;
  if (orchestratorState === "unstable_market") scores.uncertainty_scenario += 5;

  // ── Thesis → scenario interaction ─────────────────────────────────────────
  if (thesisState === "competing_theses") {
    scores.uncertainty_scenario += 20;
    scores.neutral_scenario += 5;
  }
  if (thesisState === "fragile_thesis") {
    scores.bullish_scenario = Math.max(0, scores.bullish_scenario - 10);
    scores.stress_scenario += 5;
    scores.uncertainty_scenario += 8;
  }
  if (thesisState === "invalidated_thesis") {
    scores.uncertainty_scenario += 18;
    scores.bullish_scenario = Math.max(0, scores.bullish_scenario - 8);
  }
  if (thesisState === "supported_thesis") {
    // amplify the already-leading scenario
    const maxKey = (Object.keys(scores) as ScenarioLabel[])
      .reduce((a, b) => scores[a] >= scores[b] ? a : b);
    scores[maxKey] += 8;
  }

  return scores;
}

// ─── Label selection ──────────────────────────────────────────────────────────

function selectTopTwo(scores: ScenarioScores): [ScenarioLabel, ScenarioLabel | null] {
  const sorted = (Object.keys(scores) as ScenarioLabel[])
    .sort((a, b) => scores[b] - scores[a]);
  const dominant = sorted[0];
  const second = sorted[1];
  // Only set opposing if it has a meaningful score (≥10) and differs from dominant
  const opposing = scores[second] >= 10 && second !== dominant ? second : null;
  return [dominant, opposing];
}

// ─── Uncertainty level ────────────────────────────────────────────────────────

function deriveUncertainty(
  scores: ScenarioScores,
  dominant: ScenarioLabel,
  input: ScenarioIntelligenceInput,
): "low" | "moderate" | "high" | "extreme" {
  const { hasMaterialDisagreement, firewallState, calibrationScore,
    trustState, crossMarketLabel, thesisState } = input;

  const domScore = scores[dominant];
  const secondScore = Object.values(scores)
    .filter((_, i) => Object.keys(scores)[i] !== dominant)
    .sort((a, b) => b - a)[0] ?? 0;
  const margin = domScore - secondScore;

  // Extreme: severe governance failure + thin margin
  if (
    firewallState === "blocked" &&
    (calibrationScore === "weakly_calibrated" || trustState === "fragile_calibration") &&
    margin < 10
  ) return "extreme";

  // High: material disagreement or competing theses, thin margin
  if (
    (hasMaterialDisagreement || thesisState === "competing_theses" || thesisState === "invalidated_thesis") &&
    margin < 15
  ) return "high";

  // High: conflicting cross-market
  if (crossMarketLabel === "conflicting_regime" && dominant !== "uncertainty_scenario") return "high";

  // Low: strong dominant with wide margin
  if (margin >= 20 && dominant !== "uncertainty_scenario" && !hasMaterialDisagreement) return "low";

  // Default: moderate
  return "moderate";
}

// ─── Scenario probability ─────────────────────────────────────────────────────

function deriveProbability(
  scores: ScenarioScores,
  dominant: ScenarioLabel,
  uncertainty: "low" | "moderate" | "high" | "extreme",
  calibrationScore: CalibrationScore,
): "favored" | "contested" | "uncertain" | "insufficient" {
  if (calibrationScore === "insufficient_data") return "insufficient";
  if (dominant === "uncertainty_scenario" || uncertainty === "extreme") return "uncertain";

  const domScore = scores[dominant];
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const share = domScore / total;

  if (share >= 0.45 && uncertainty === "low") return "favored";
  if (share >= 0.35 || uncertainty === "moderate") return "contested";
  return "uncertain";
}

// ─── Confidence pressure ──────────────────────────────────────────────────────

function deriveConfidencePressure(
  dominant: ScenarioLabel,
  uncertainty: "low" | "moderate" | "high" | "extreme",
  probability: "favored" | "contested" | "uncertain" | "insufficient",
): number {
  if (dominant === "stress_scenario" || dominant === "uncertainty_scenario") return -5;
  if (uncertainty === "extreme") return -4;
  if (uncertainty === "high") return -3;
  if (probability === "favored" && uncertainty === "low") return 2;
  if (probability === "favored") return 1;
  if (uncertainty === "moderate") return -1;
  return 0;
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  dominant: ScenarioLabel,
  opposing: ScenarioLabel | null,
  probability: "favored" | "contested" | "uncertain" | "insufficient",
  ar: boolean,
): string {
  const probText = ar
    ? { favored: "مرجَّح", contested: "متنازع", uncertain: "غير محدد", insufficient: "أدلة غير كافية" }[probability]
    : { favored: "scenario favored", contested: "scenario contested", uncertain: "uncertainty elevated", insufficient: "insufficient evidence" }[probability];

  const stateLabels: Record<ScenarioLabel, { en: string; ar: string }> = {
    bullish_scenario:     { en: "bullish",     ar: "صعودي" },
    bearish_scenario:     { en: "bearish",     ar: "هبوطي" },
    neutral_scenario:     { en: "neutral",     ar: "محايد" },
    rotational_scenario:  { en: "rotational",  ar: "دوراني" },
    stress_scenario:      { en: "stress",      ar: "ضغط" },
    uncertainty_scenario: { en: "uncertainty", ar: "عدم يقين" },
  };

  const dom = ar ? stateLabels[dominant].ar : stateLabels[dominant].en;
  const opp = opposing ? (ar ? stateLabels[opposing].ar : stateLabels[opposing].en) : null;

  if (ar) {
    const oppNote = opp ? `؛ الحالة المعارضة (${opp}) تحافظ على ثقل` : "";
    return `السيناريو السائد: ${dom} — ${probText}${oppNote}. استشاري فقط — لا تنبؤ.`;
  }
  const oppNote = opp ? `; opposing case (${opp}) retains weight` : "";
  return `Dominant scenario: ${dom} — ${probText}${oppNote}. Advisory only — not a prediction.`;
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  dominant: ScenarioLabel,
  opposing: ScenarioLabel | null,
  probability: "favored" | "contested" | "uncertain" | "insufficient",
): string {
  if (probability === "insufficient") return "";
  const oppStr = opposing ? `; opposing: ${opposing.replace(/_/g, " ")}` : "";
  return `Scenario: ${dominant.replace(/_/g, " ")} (${probability})${oppStr}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeScenarioIntelligence(
  input: ScenarioIntelligenceInput,
): ScenarioIntelligenceResult {
  const { ar } = input;

  const scores = scoreScenarios(input);
  const [dominant, opposing] = selectTopTwo(scores);
  const uncertaintyLevel = deriveUncertainty(scores, dominant, input);
  const scenarioProbability = deriveProbability(scores, dominant, uncertaintyLevel, input.calibrationScore);
  const scenarioConfidencePressure = deriveConfidencePressure(dominant, uncertaintyLevel, scenarioProbability);
  const narrative = buildNarrative(dominant, opposing, scenarioProbability, ar);
  const contextString = buildContextString(dominant, opposing, scenarioProbability);

  return {
    dominantScenario: dominant,
    opposingScenario: opposing,
    scenarioConfidencePressure,
    uncertaintyLevel,
    scenarioProbability,
    narrative,
    contextString,
    hasStressSignal: dominant === "stress_scenario" || uncertaintyLevel === "extreme",
  };
}
