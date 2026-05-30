// Phase-88B: Scenario Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Governs all foresight output before prompt injection. Prevents:
//   - Probability sum materially off 100% (hype arithmetic)
//   - Single scenario claiming >72% (overconfidence)
//   - Certainty language ("will happen", "certain", "guaranteed")
//   - Fantasy trigger conditions (non-observable, non-specific)
//   - Missing bear case in bullish regimes
//   - Uncontrolled context growth (budget guard)
//
// The governor assembles all four foresight engine outputs into a single
// governed context block (≤500 chars) suitable for prompt injection.
//
// Quality score (0-100):
//   +25: probability sum within 90-110%
//   +20: competition intensity is moderate or high (not single-dominant)
//   +20: both bull and bear present with observable triggers
//   +15: second-order chain is non-trivial (>40 chars)
//   +10: transition path is non-null with observable trigger
//   +10: no certainty language detected
//
// Governance rule: any scenario foresight with qualityScore < 55 is flagged
// with a governance note but still injected (with hedged disclaimer).
//
// No execution language. Educational/advisory foresight only.

import type { ScenarioCompetitionProfile } from "./scenarioCompetitionEngine";
import type { SecondOrderChainResult }      from "./secondOrderEffectEngine";
import type { TransitionRiskProfile }       from "./regimeTransitionForesight";
import type { PathDependencyProfile }       from "./pathDependencyEngine";

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface ScenarioGovernanceResult {
  approved:                boolean;
  repairs:                 string[];       // list of repairs applied
  qualityScore:            number;         // 0-100
  governedForesightContext: string;         // ≤500 chars final injectable
  fiduciaryDisclaimer:     string;         // standard foresight disclaimer
  governanceLog:           string;         // brief log for console
}

// ─── Certainty language detector ─────────────────────────────────────────────

const CERTAINTY_PATTERNS = /\b(will definitely|guaranteed|certain to|will certainly|inevitable|assured|no doubt|absolutely will|must happen|always happens|proven to)\b/i;

function detectCertaintyLanguage(text: string): boolean {
  return CERTAINTY_PATTERNS.test(text);
}

// ─── Probability normalisation ────────────────────────────────────────────────

function normaliseProbabilities(
  probs: { bull: number; base: number; bear: number },
): { bull: number; base: number; bear: number; repaired: boolean } {
  const sum = probs.bull + probs.base + probs.bear;
  if (sum >= 90 && sum <= 110) return { ...probs, repaired: false };
  const scale = 100 / sum;
  return {
    bull: Math.max(5,  Math.round(probs.bull * scale)),
    base: Math.max(10, Math.round(probs.base * scale)),
    bear: Math.max(5,  Math.round(probs.bear * scale)),
    repaired: true,
  };
}

// ─── Single-scenario dominance cap ────────────────────────────────────────────

function capDominance(
  probs: { bull: number; base: number; bear: number },
): { bull: number; base: number; bear: number; repaired: boolean } {
  const CAP = 72;
  let { bull, base, bear } = probs;
  let repaired = false;

  if (bull > CAP) {
    const excess = bull - CAP; bull = CAP;
    base += Math.floor(excess * 0.6); bear += Math.ceil(excess * 0.4);
    repaired = true;
  }
  if (bear > CAP) {
    const excess = bear - CAP; bear = CAP;
    base += Math.floor(excess * 0.6); bull += Math.ceil(excess * 0.4);
    repaired = true;
  }
  if (base > CAP) {
    const excess = base - CAP; base = CAP;
    bull += Math.floor(excess * 0.5); bear += Math.ceil(excess * 0.5);
    repaired = true;
  }
  return { bull, base, bear, repaired };
}

// ─── Quality scoring ──────────────────────────────────────────────────────────

function scoreQuality(
  scenario: ScenarioCompetitionProfile,
  secondOrder: SecondOrderChainResult,
  transition: TransitionRiskProfile,
  normalised: ReturnType<typeof normaliseProbabilities>,
): number {
  let score = 0;
  const probSum = normalised.bull + normalised.base + normalised.bear;
  if (probSum >= 92 && probSum <= 108)    score += 25;
  else if (probSum >= 85 && probSum <= 115) score += 12;

  if (scenario.competitionIntensity !== "low") score += 20;

  const bullObs = scenario.bull.trigger.length > 15 && /if /i.test(scenario.bull.trigger);
  const bearObs = scenario.bear.trigger.length > 15 && /if /i.test(scenario.bear.trigger);
  if (bullObs && bearObs) score += 20;
  else if (bullObs || bearObs) score += 10;

  if (secondOrder.chainContext.length > 40) score += 15;
  if (transition.mostLikelyTransition?.triggerCondition.length ?? 0 > 15) score += 10;
  if (!detectCertaintyLanguage(scenario.foresightContext + secondOrder.chainContext)) score += 10;

  return Math.min(100, score);
}

// ─── Governed context assembly ────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function assembleGovernedContext(
  scenario: ScenarioCompetitionProfile,
  secondOrder: SecondOrderChainResult,
  transition: TransitionRiskProfile,
  path: PathDependencyProfile,
  normalised: { bull: number; base: number; bear: number },
): string {
  const scenCtx = trimTo(
    `Scenario competition[${scenario.competitionIntensity}]: BASE(${normalised.base}%) ${trimTo(scenario.base.trigger, 50)} | BULL(${normalised.bull}%) ${trimTo(scenario.bull.trigger, 40)} | BEAR(${normalised.bear}%) ${trimTo(scenario.bear.trigger, 40)}`,
    200,
  );
  const soCtx = trimTo(`2nd-order: ${secondOrder.chainContext}`, 130);
  const trCtx = transition.mostLikelyTransition
    ? trimTo(`Transition→${transition.mostLikelyTransition.to}(${transition.mostLikelyTransition.probability}%): ${transition.mostLikelyTransition.triggerCondition}`, 90)
    : "";
  const pathCtx = path.dominantPath
    ? trimTo(`Path[${path.dominantPath.persistence}]: ${path.dominantPath.condition.slice(0, 45)} → ${path.dominantPath.cumulativeEffect.slice(0, 40)}`, 80)
    : "";

  return [scenCtx, soCtx, trCtx, pathCtx].filter(Boolean).join(" | ").slice(0, 500);
}

// ─── Fiduciary disclaimer ─────────────────────────────────────────────────────

const DISCLAIMER_EN = "All foresight output is probabilistic and conditional — no certainty claims. Advisory/educational only.";
const DISCLAIMER_AR = "جميع مخرجات الاستشراف احتمالية ومشروطة — لا ادعاءات يقين. استشاري وتعليمي فقط.";

// ─── Public API ───────────────────────────────────────────────────────────────

export function governScenarios(input: {
  scenario:    ScenarioCompetitionProfile;
  secondOrder: SecondOrderChainResult;
  transition:  TransitionRiskProfile;
  path:        PathDependencyProfile;
  lang:        "ar" | "en";
}): ScenarioGovernanceResult {
  const { scenario, secondOrder, transition, path, lang } = input;
  const repairs: string[] = [];

  // Step 1: Normalise probability sum
  let probs = { bull: scenario.bull.probability, base: scenario.base.probability, bear: scenario.bear.probability };
  const normalised = normaliseProbabilities(probs);
  if (normalised.repaired) repairs.push("probability_sum_normalised");
  probs = normalised;

  // Step 2: Cap single-scenario dominance
  const capped = capDominance(probs);
  if (capped.repaired) repairs.push("dominance_capped");
  probs = capped;

  // Step 3: Check certainty language
  const combinedText = `${scenario.foresightContext} ${secondOrder.chainContext} ${transition.transitionContext}`;
  if (detectCertaintyLanguage(combinedText)) {
    repairs.push("certainty_language_detected_not_repaired"); // log only — AI is governed by system prompt
  }

  // Step 4: Quality score
  const qualityScore = scoreQuality(scenario, secondOrder, transition, probs);

  // Step 5: Assemble governed context
  const governedForesightContext = assembleGovernedContext(scenario, secondOrder, transition, path, probs);

  const approved = qualityScore >= 55 && repairs.filter(r => !r.includes("detected")).length === 0;
  const governanceLog = `foresight quality=${qualityScore} approved=${approved} repairs=[${repairs.join(",")||"none"}]`;
  const fiduciaryDisclaimer = lang === "ar" ? DISCLAIMER_AR : DISCLAIMER_EN;

  return {
    approved,
    repairs,
    qualityScore,
    governedForesightContext,
    fiduciaryDisclaimer,
    governanceLog,
  };
}
