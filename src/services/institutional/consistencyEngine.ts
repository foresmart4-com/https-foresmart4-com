// Phase-70 Part-2: Response Consistency Layer
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Problem: same question can produce wildly different answer quality because
// internal reply fields can contradict each other — thesis bullish but regime
// bearish; confidence 75% but evidenceStrength 20; scenarios sum to 140%;
// committeeStance "defensive" but confidence is "high".
//
// This module:
//   1. Detects internal inconsistencies within a single reply
//   2. Makes deterministic light repairs to the reply in place
//   3. Returns a ConsistencyResult describing what was found and fixed
//
// Consistency states:
//   stable            — all checks pass; no significant conflicts
//   moderate_variance — 1-2 minor conflicts; repaired or noted
//   unstable_generation — 3+ conflicts; structural inconsistency
//
// Design rules:
// - Never overwrites AI-produced content with fabrications
// - Repairs are additive (caveats, normalisation) not destructive replacements
// - No new directional claims from repairs — only structural fixes
// - No AI calls, no execution, no certainty amplification
// - O(1), deterministic, bounded

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConsistencyState =
  | "stable"               // all checks pass; internal coherence confirmed
  | "moderate_variance"    // 1-2 minor conflicts detected; repaired
  | "unstable_generation"; // 3+ conflicts; structural repair applied

export interface ConsistencyCheck {
  id: string;
  passed: boolean;
  description: string;   // what was checked
  issue: string | null;  // what conflict was found (null if passed)
  repaired: boolean;     // whether a deterministic repair was applied
}

export interface ConsistencyResult {
  consistencyState: ConsistencyState;
  checksRun: number;
  checksPassed: number;
  conflicts: ConsistencyCheck[];
  repairsApplied: number;
  contextString: string; // compact ≤80 chars for logging/context
}

// ─── Check 1: Thesis-regime direction alignment ───────────────────────────────

function checkThesisRegimeAlignment(reply: GenesisReply, checks: ConsistencyCheck[]): void {
  if (!reply.thesis || !reply.regime) {
    checks.push({ id: "thesis_regime", passed: true, description: "Thesis-regime alignment", issue: null, repaired: false });
    return;
  }
  const thesis = reply.thesis.toLowerCase();
  const regime = reply.regime.toLowerCase();
  const bullThesis = /bull|upside|rise|صاعد|long/.test(thesis);
  const bearRegime = /bear|risk.?off|ranging|هابط/.test(regime);
  const bearThesis = /bear|downside|fall|هابط|short/.test(thesis);
  const bullRegime = /bull|risk.?on|accumulation|صاعد/.test(regime);

  const conflict = (bullThesis && bearRegime) || (bearThesis && bullRegime);
  if (!conflict) {
    checks.push({ id: "thesis_regime", passed: true, description: "Thesis-regime alignment", issue: null, repaired: false });
    return;
  }
  const issueStr = bullThesis
    ? `Bullish thesis in ${reply.regime} regime — structural headwind`
    : `Bearish thesis in ${reply.regime} regime — counter-trend position`;

  // Repair: add a caveat noting the tension (never overwrite thesis or regime)
  let repaired = false;
  if (!reply.caveats || !reply.caveats.some(c => /regime|thesis|contradict|conflict/i.test(c))) {
    reply.caveats = [...(reply.caveats ?? []),
      `Thesis direction conflicts with stated regime (${reply.regime}) — cross-trend position requires additional evidence.`
    ].slice(0, 3);
    repaired = true;
  }
  checks.push({ id: "thesis_regime", passed: false, description: "Thesis-regime alignment", issue: issueStr, repaired });
}

// ─── Check 2: Confidence vs evidence strength ─────────────────────────────────

function checkConfidenceEvidenceGap(reply: GenesisReply, checks: ConsistencyCheck[]): void {
  const conf = reply.confidence;
  const es = reply.evidenceStrength;
  if (es === undefined) {
    checks.push({ id: "conf_evidence", passed: true, description: "Confidence-evidence alignment", issue: null, repaired: false });
    return;
  }
  const gap = conf - es;
  if (gap <= 20) {
    checks.push({ id: "conf_evidence", passed: true, description: "Confidence-evidence alignment", issue: null, repaired: false });
    return;
  }
  const issueStr = `Confidence ${conf}% exceeds evidenceStrength ${es}/100 by ${gap}pts — possible assertion`;
  // Repair: add confidenceCalibration note if absent
  let repaired = false;
  if (!reply.confidenceCalibration && !reply.confidenceExplanation) {
    reply.confidenceExplanation = `Confidence (${conf}%) is above the evidence strength (${es}/100); treated as a calibration anchor, not a certainty assertion.`;
    repaired = true;
  }
  checks.push({ id: "conf_evidence", passed: false, description: "Confidence-evidence alignment", issue: issueStr, repaired });
}

// ─── Check 3: Scenario probability sum ───────────────────────────────────────

function checkScenarioProbabilities(reply: GenesisReply, checks: ConsistencyCheck[]): void {
  const scenarios = reply.scenarios ?? [];
  if (scenarios.length === 0) {
    checks.push({ id: "scenario_sum", passed: true, description: "Scenario probability sum", issue: null, repaired: false });
    return;
  }
  const values = scenarios.map(s => parseInt(s.probability.replace(/[^0-9]/g, "")) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0 || Math.abs(total - 100) <= 15) {
    checks.push({ id: "scenario_sum", passed: true, description: "Scenario probability sum", issue: null, repaired: false });
    return;
  }
  const issueStr = `Scenario probabilities sum to ~${total}% (expected ~100%)`;
  // Repair: normalise probabilities proportionally
  let repaired = false;
  if (total > 0 && scenarios.length > 0) {
    reply.scenarios = scenarios.map((s, i) => ({
      ...s,
      probability: `~${Math.round((values[i] / total) * 100)}%`,
    }));
    repaired = true;
  }
  checks.push({ id: "scenario_sum", passed: false, description: "Scenario probability sum", issue: issueStr, repaired });
}

// ─── Check 4: Bull-bear cases point opposite directions ───────────────────────

function checkBullBearBalance(reply: GenesisReply, checks: ConsistencyCheck[]): void {
  if (!reply.bullCase || !reply.bearCase) {
    checks.push({ id: "bull_bear", passed: true, description: "Bull-bear direction balance", issue: null, repaired: false });
    return;
  }
  const bullText = reply.bullCase.toLowerCase();
  const bearText = reply.bearCase.toLowerCase();
  const bullIsBullish = /upside|support|positive|صاعد|ارتفاع|دعم|إيجابي|benefit|favor/.test(bullText);
  const bearIsBullish = /upside|support|positive|صاعد|ارتفاع|دعم|إيجابي|benefit|favor/.test(bearText);
  if (bullIsBullish !== bearIsBullish) {
    checks.push({ id: "bull_bear", passed: true, description: "Bull-bear direction balance", issue: null, repaired: false });
    return;
  }
  const issueStr = "Bull and bear cases appear to point the same direction — debate is unbalanced";
  // Repair: add a caveat noting the balance issue (can't rewrite content)
  let repaired = false;
  if (!reply.caveats?.some(c => /bull|bear|balance|debate/.test(c.toLowerCase()))) {
    reply.caveats = [...(reply.caveats ?? []),
      "Bull and bear case framing may lack balance — both should state opposing directional arguments."
    ].slice(0, 3);
    repaired = true;
  }
  checks.push({ id: "bull_bear", passed: false, description: "Bull-bear direction balance", issue: issueStr, repaired });
}

// ─── Check 5: Committee stance vs confidence alignment ────────────────────────

function checkCommitteeConfidenceAlignment(reply: GenesisReply, checks: ConsistencyCheck[]): void {
  if (!reply.committeeStance || reply.confidence === undefined) {
    checks.push({ id: "committee_conf", passed: true, description: "Committee-confidence alignment", issue: null, repaired: false });
    return;
  }
  const stance = reply.committeeStance;
  const conf = reply.confidence;
  const defensiveHighConf = (stance === "defensive" || stance === "wait_for_confirmation") && conf >= 70;
  const selectiveOverBroadLowConf = stance === "selective_over_broad" && conf < 40;
  if (!defensiveHighConf && !selectiveOverBroadLowConf) {
    checks.push({ id: "committee_conf", passed: true, description: "Committee-confidence alignment", issue: null, repaired: false });
    return;
  }
  const issueStr = defensiveHighConf
    ? `${stance} committee stance with high confidence (${conf}%) — defensive posture usually implies lower conviction`
    : `selective_over_broad stance with very low confidence (${conf}%) — selectivity requires conviction`;
  // Repair: if defensive + high conf, add uncertainty caveat
  let repaired = false;
  if (defensiveHighConf && !reply.uncertaintyWarning) {
    reply.uncertaintyWarning = `Committee stance (${stance}) and confidence level (${conf}%) may be inconsistent — defensive postures typically reflect lower directional certainty.`;
    repaired = true;
  }
  checks.push({ id: "committee_conf", passed: false, description: "Committee-confidence alignment", issue: issueStr, repaired });
}

// ─── Check 6: Caveats present for shallow/conflicted reasoning ────────────────

function checkCaveatsForWeakReasoning(reply: GenesisReply, checks: ConsistencyCheck[]): void {
  const isWeak = reply.reasoningDepth === "shallow" || reply.reasoningDepth === "insufficient"
    || reply.consensusStrength === "conflicted" || reply.uncertaintyLevel === "conflicting";
  const hasCaveats = (reply.caveats?.length ?? 0) > 0;
  if (!isWeak || hasCaveats) {
    checks.push({ id: "caveats_weak", passed: true, description: "Caveats for weak/conflicted reasoning", issue: null, repaired: false });
    return;
  }
  const issueStr = `Shallow/conflicted reasoning (depth=${reply.reasoningDepth}, consensus=${reply.consensusStrength}) but no caveats present`;
  // Repair: add a structural caveat
  reply.caveats = ["Reasoning depth is limited in this response — directional view should be treated as indicative, not high-conviction."];
  checks.push({ id: "caveats_weak", passed: false, description: "Caveats for weak/conflicted reasoning", issue: issueStr, repaired: true });
}

// ─── State derivation ─────────────────────────────────────────────────────────

function deriveConsistencyState(conflicts: ConsistencyCheck[]): ConsistencyState {
  const failCount = conflicts.filter(c => !c.passed).length;
  if (failCount >= 3) return "unstable_generation";
  if (failCount >= 1) return "moderate_variance";
  return "stable";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks internal consistency of a GenesisReply and applies deterministic repairs.
 * Mutates reply in place for repairs; returns ConsistencyResult describing findings.
 */
export function checkAndRepairConsistency(reply: GenesisReply): ConsistencyResult {
  const checks: ConsistencyCheck[] = [];

  checkThesisRegimeAlignment(reply, checks);
  checkConfidenceEvidenceGap(reply, checks);
  checkScenarioProbabilities(reply, checks);
  checkBullBearBalance(reply, checks);
  checkCommitteeConfidenceAlignment(reply, checks);
  checkCaveatsForWeakReasoning(reply, checks);

  const conflicts = checks.filter(c => !c.passed);
  const repairsApplied = conflicts.filter(c => c.repaired).length;
  const consistencyState = deriveConsistencyState(conflicts);

  const contextString = conflicts.length === 0
    ? "Consistency: stable"
    : `Consistency: ${consistencyState} | ${conflicts.length} conflict(s) | ${repairsApplied} repair(s)`.slice(0, 80);

  return {
    consistencyState,
    checksRun: checks.length,
    checksPassed: checks.filter(c => c.passed).length,
    conflicts,
    repairsApplied,
    contextString,
  };
}
